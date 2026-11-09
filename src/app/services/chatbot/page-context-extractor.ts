import {
  PAGE_CONTEXT_LIMITS as LIMITS,
  PageElement,
  PageElementType,
  PageScalar
} from '../../models/page-context.model';

/**
 * Turns the rendered Angular page (DOM) into the bounded, structured element list the agent
 * backend expects as visual page context. Pure and framework-free: it only reads the DOM.
 *
 * What is NOT captured, by design (privacy):
 *  - anything inside `[data-assistant-ignore]` or the chatbot widgets themselves;
 *  - password / hidden / file inputs, and fields that look like secrets (name/id/autocomplete);
 *  - hidden (not rendered) elements.
 *
 * Add `data-assistant-ignore` to any element whose content must never reach the assistant.
 */

/** Descendants of these are never captured. */
const IGNORE_SELECTOR = 'app-chatbot-integrated, app-chatbot-standalone, [data-assistant-ignore]';

const CANDIDATE_SELECTOR =
  'h1, h2, h3, input, select, textarea, button, table, [role="tab"], [role="alert"]';

/** Never walk more than this many candidates (pages with huge lists). */
const MAX_CANDIDATES = 1500;

const SENSITIVE_NAME = /pass(word)?|pwd|secret|token|cvv|cvc|iban|otp/i;
const SENSITIVE_AUTOCOMPLETE = /^(cc-|one-time-code|current-password|new-password)/i;

/** Lower number = more important; used to decide what survives when the page is too big. */
type Priority = 0 | 1 | 2;

interface Candidate {
  el: PageElement;
  priority: Priority;
}

export interface ExtractedPage {
  /** First visible <h1>, if any. */
  pageTitle?: string;
  elements: PageElement[];
}

// ─── text helpers ───────────────────────────────────────────────────────────

function norm(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function clip(text: string, limit: number): string {
  return text.length > limit ? text.slice(0, limit - 1) + '…' : text;
}

function short(text: string | null | undefined): string {
  return clip(norm(text), LIMITS.maxShortText);
}

/** Visible text of an element, ignoring icons and form controls nested inside it. */
function ownText(node: Node): string {
  let out = '';
  node.childNodes.forEach(child => {
    if (child.nodeType === 3 /* TEXT_NODE */) {
      out += child.textContent ?? '';
    } else if (child.nodeType === 1 /* ELEMENT_NODE */) {
      const el = child as Element;
      if (el.matches('.material-icons, .material-symbols-outlined, svg, script, style, select, textarea, option, [aria-hidden="true"]')) {
        return;
      }
      out += ' ' + ownText(el) + ' ';
    }
  });
  return norm(out);
}

/** UTF-8 byte length without relying on TextEncoder being available. */
function utf8Length(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4; // surrogate pair
      i++;
    } else bytes += 3;
  }
  return bytes;
}

// ─── DOM helpers ────────────────────────────────────────────────────────────

function isVisible(el: Element): boolean {
  const withCheck = el as Element & { checkVisibility?: (options?: object) => boolean };
  if (typeof withCheck.checkVisibility === 'function') {
    return withCheck.checkVisibility({ checkVisibilityCSS: true });
  }
  // Fallback (older browsers, jsdom): walk the ancestors.
  const view = el.ownerDocument.defaultView;
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (node.hasAttribute('hidden')) return false;
    const style = view?.getComputedStyle(node);
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
  }
  return true;
}

function textOfIds(el: Element, ids: string | null): string {
  if (!ids) return '';
  return norm(
    ids
      .split(/\s+/)
      .map(id => el.ownerDocument.getElementById(id))
      .filter((node): node is HTMLElement => !!node)
      .map(node => ownText(node))
      .join(' ')
  );
}

/** Best human-readable label for a control, following how this app writes its templates. */
function labelFor(el: Element): string {
  const labelled = textOfIds(el, el.getAttribute('aria-labelledby'));
  if (labelled) return short(labelled);

  const aria = norm(el.getAttribute('aria-label'));
  if (aria) return short(aria);

  const labels = (el as HTMLInputElement).labels;
  if (labels && labels.length > 0) {
    const text = ownText(labels[0]);
    if (text) return short(text);
  }
  const wrapping = el.closest('label');
  if (wrapping) {
    const text = ownText(wrapping);
    if (text) return short(text);
  }

  // Key/value tables: the header cell on the same row, or the cell just before.
  const cell = el.closest('td');
  if (cell) {
    const header = cell.parentElement?.querySelector('th');
    const source = header && !header.contains(el) ? header : cell.previousElementSibling;
    const text = source ? ownText(source) : '';
    if (text) return short(text);
  }

  // A <label> sitting next to the control (same wrapper, or the wrapper's wrapper).
  for (let wrapper: Element | null = el.parentElement, depth = 0; wrapper && depth < 2; wrapper = wrapper.parentElement, depth++) {
    const sibling = Array.from(wrapper.children).find(child => child.tagName === 'LABEL' && !child.contains(el));
    if (sibling) {
      const text = ownText(sibling);
      if (text) return short(text);
    }
  }

  return short(el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('name'));
}

function groupFor(el: Element): string | undefined {
  const legend = el.closest('fieldset')?.querySelector('legend');
  const text = legend ? ownText(legend) : '';
  return text ? short(text) : undefined;
}

function isSensitive(el: Element): boolean {
  const autocomplete = el.getAttribute('autocomplete') ?? '';
  if (SENSITIVE_AUTOCOMPLETE.test(autocomplete)) return true;
  return SENSITIVE_NAME.test(el.getAttribute('name') ?? '') || SENSITIVE_NAME.test(el.id ?? '');
}

function errorFor(el: Element): string | undefined {
  const flagged =
    el.getAttribute('aria-invalid') === 'true' ||
    el.classList.contains('is-invalid') ||
    (el.classList.contains('ng-invalid') && (el.classList.contains('ng-touched') || el.classList.contains('ng-dirty')));
  if (!flagged) return undefined;

  const described = textOfIds(el, el.getAttribute('aria-describedby'));
  if (described) return short(described);
  const feedback = el.parentElement?.querySelector('.invalid-feedback, .text-danger, .error');
  const text = feedback ? ownText(feedback) : '';
  return text ? short(text) : 'Marked as invalid';
}

function isEnabled(el: Element): boolean {
  return !(el as HTMLButtonElement).disabled && el.getAttribute('aria-disabled') !== 'true';
}

/** Options of a custom (non-<select>) dropdown, read even while the menu is closed. */
function customDropdownOptions(button: Element): string[] {
  const menuId = button.getAttribute('aria-controls');
  const menu =
    (menuId ? button.ownerDocument.getElementById(menuId) : null) ??
    (button.nextElementSibling?.matches('.dropdown-menu, [role="listbox"], [role="menu"]') ? button.nextElementSibling : null);
  if (!menu) return [];
  const items = Array.from(menu.querySelectorAll('[role="option"], li, a, button'));
  const texts = items.map(item => short(ownText(item))).filter(Boolean);
  return Array.from(new Set(texts)).slice(0, LIMITS.maxOptions);
}

// ─── per-element builders ───────────────────────────────────────────────────

class Collector {
  readonly candidates: Candidate[] = [];
  private readonly usedIds = new Set<string>();
  private readonly radioGroups = new Map<string, PageElement>();
  private counter = 0;
  pageTitle?: string;

  add(type: PageElementType, source: Element | null, element: Omit<PageElement, 'id' | 'type'>, priority: Priority): PageElement {
    const built: PageElement = { id: this.uniqueId(type, source), type, ...element };
    this.candidates.push({ el: built, priority });
    return built;
  }

  /** One element per radio group (keyed by name); options are the group's labels. */
  radio(input: HTMLInputElement, priority: Priority): void {
    const label = labelFor(input);
    if (!input.name) {
      this.add('radio', input, { label, value: input.checked, ...this.common(input) }, priority);
      return;
    }
    const key = `${input.form?.id ?? ''}::${input.name}`;
    let group = this.radioGroups.get(key);
    if (!group) {
      const legend = groupFor(input);
      const container = input.closest('[role="radiogroup"]');
      const groupLabel = container ? labelFor(container) : '';
      group = this.add('radio', input, { label: legend || groupLabel || short(input.name), options: [], ...this.common(input, true) }, priority);
      this.radioGroups.set(key, group);
    }
    if ((group.options?.length ?? 0) < LIMITS.maxOptions) group.options?.push(label || short(input.value));
    if (input.checked) group.selected = label || short(input.value);
  }

  /** Properties shared by every form control. */
  common(el: Element, skipGroup = false): Partial<PageElement> {
    const out: Partial<PageElement> = {};
    if (!isEnabled(el)) out.enabled = false;
    if ((el as HTMLInputElement).required || el.getAttribute('aria-required') === 'true') out.required = true;
    const error = errorFor(el);
    if (error) out.error = error;
    const group = skipGroup ? undefined : groupFor(el);
    if (group) out.group = group;
    return out;
  }

  private uniqueId(type: string, source: Element | null): string {
    const raw =
      source?.id ||
      source?.getAttribute('data-testid') ||
      source?.getAttribute('formcontrolname') ||
      source?.getAttribute('name') ||
      `${type}-${++this.counter}`;
    const base = clip(norm(raw), LIMITS.maxShortText - 8);
    let id = base;
    for (let n = 2; this.usedIds.has(id); n++) id = `${base}-${n}`;
    this.usedIds.add(id);
    return id;
  }
}

function collectInput(input: HTMLInputElement, out: Collector): void {
  const type = (input.type || 'text').toLowerCase();
  if (['hidden', 'password', 'file', 'image', 'color'].includes(type) || isSensitive(input)) return;

  if (type === 'submit' || type === 'button' || type === 'reset') {
    const label = short(input.value || input.getAttribute('aria-label'));
    if (label) out.add('button', input, { label, ...out.common(input) }, 2);
    return;
  }
  if (type === 'radio') return out.radio(input, 0);

  const label = labelFor(input);
  const base = { label: label || undefined, ...out.common(input) };

  if (type === 'checkbox') {
    const isSwitch = input.getAttribute('role') === 'switch' || !!input.closest('.form-switch');
    out.add(isSwitch ? 'switch' : 'checkbox', input, { ...base, value: input.checked }, 0);
  } else if (type === 'number' || type === 'range') {
    const parsed = input.value === '' ? null : Number(input.value);
    out.add('number', input, { ...base, value: parsed !== null && Number.isNaN(parsed) ? input.value : parsed }, 0);
  } else if (['date', 'datetime-local', 'time', 'month', 'week'].includes(type)) {
    out.add('date', input, { ...base, value: input.value }, 0);
  } else {
    out.add('textbox', input, { ...base, value: clip(input.value, LIMITS.maxText) }, 0);
  }
}

function collectSelect(select: HTMLSelectElement, out: Collector): void {
  if (isSensitive(select)) return;
  const options = Array.from(select.options)
    .map(option => short(option.text))
    .filter(Boolean)
    .slice(0, LIMITS.maxOptions);
  const chosen = Array.from(select.selectedOptions)
    .filter(option => option.value !== '')
    .map(option => short(option.text));
  const element: Omit<PageElement, 'id' | 'type'> = {
    label: labelFor(select) || undefined,
    options,
    ...out.common(select)
  };
  if (select.multiple) {
    out.add('multiselect', select, { ...element, selected: chosen }, 0);
  } else {
    out.add('dropdown', select, chosen.length ? { ...element, selected: chosen[0] } : element, 0);
  }
}

function collectTab(tab: Element, out: Collector): void {
  const label = short(ownText(tab) || tab.getAttribute('aria-label'));
  if (!label) return;
  const selected = tab.getAttribute('aria-selected') ?? (tab.classList.contains('active') ? 'true' : 'false');
  out.add('tab', tab, { label, value: selected === 'true', ...out.common(tab) }, 1);
}

function collectButton(button: HTMLButtonElement, out: Collector): void {
  // Menu / listbox options are reported as the options of their dropdown, not as buttons.
  if (button.closest('[role="listbox"], [role="menu"], .dropdown-menu')) return;
  // Row actions of a data grid would drown out everything else.
  if (button.closest('td') && button.closest('table')?.querySelector('thead')) return;

  if (button.getAttribute('role') === 'tab') return collectTab(button, out);

  const text = ownText(button);
  const popup = button.getAttribute('aria-haspopup') || button.getAttribute('data-bs-toggle') === 'dropdown';
  // A popup button that is labelled by a separate <label> behaves like a dropdown form control.
  if (popup && button.getAttribute('aria-labelledby') && text) {
    const label = labelFor(button);
    const options = customDropdownOptions(button);
    out.add('dropdown', button, { label: label || undefined, selected: short(text), ...(options.length ? { options } : {}), ...out.common(button) }, 0);
    return;
  }

  const label = short(button.getAttribute('aria-label') || text || button.getAttribute('title'));
  if (label) out.add('button', button, { label, ...out.common(button) }, 2);
}

function collectTable(table: HTMLTableElement, out: Collector): void {
  const rows = Array.from(table.rows);
  const headerRows = rows.filter(row => row.parentElement?.tagName === 'THEAD');
  const bodyRows = rows.filter(row => row.parentElement?.tagName !== 'THEAD');

  const headerSource = headerRows[headerRows.length - 1];
  const columns = headerSource
    ? Array.from(headerSource.cells).map(cell => short(ownText(cell)))
    : [];

  const cellsOf = (row: HTMLTableRowElement): PageScalar[] =>
    Array.from(row.cells)
      .slice(0, LIMITS.maxTableColumns)
      .map(cell => short(ownText(cell)));
  const sample = bodyRows
    .map(cellsOf)
    .filter(cells => cells.some(cell => cell !== ''))
    .slice(0, LIMITS.maxTableRows);
  if (columns.length === 0 && sample.length === 0) return;

  const caption = table.querySelector('caption');
  const label = short(table.getAttribute('aria-label') || (caption ? ownText(caption) : ''));
  out.add(
    'table',
    table,
    {
      ...(label ? { label } : {}),
      ...(columns.length ? { columns: columns.slice(0, LIMITS.maxTableColumns) } : {}),
      rows: sample,
      ...(bodyRows.length > sample.length ? { row_count: bodyRows.length } : {})
    },
    0
  );
}

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * Keep the most important elements within the backend's count and byte limits.
 * Buttons go first, then tabs / alerts / sub-headings, then (only if still needed) the tail of the
 * form controls and tables. Document order of the survivors is preserved.
 */
function fitToLimits(candidates: Candidate[], envelopeBytes: number): PageElement[] {
  const sizes = candidates.map(candidate => utf8Length(JSON.stringify(candidate.el)) + 1);
  let bytes = envelopeBytes + sizes.reduce((sum, size) => sum + size, 0);
  let count = candidates.length;
  const keep = candidates.map(() => true);

  const victims: number[] = [];
  for (const priority of [2, 1, 0]) {
    for (let i = candidates.length - 1; i >= 0; i--) {
      if (candidates[i].priority === priority) victims.push(i);
    }
  }
  for (const index of victims) {
    if (count <= LIMITS.maxElements && bytes <= LIMITS.maxBytes) break;
    keep[index] = false;
    count--;
    bytes -= sizes[index];
  }
  return candidates.filter((_, i) => keep[i]).map(candidate => candidate.el);
}

/**
 * @param roots elements to read (e.g. `<main>` and any open dialog); nested roots are de-duplicated.
 * @param envelopeBytes size reserved for the rest of the payload (route, title, ...).
 */
export function extractPage(roots: Element[], envelopeBytes = 1024): ExtractedPage {
  const out = new Collector();
  const uniqueRoots = roots.filter(root => !roots.some(other => other !== root && other.contains(root)));

  let seen = 0;
  for (const root of uniqueRoots) {
    for (const node of Array.from(root.querySelectorAll(CANDIDATE_SELECTOR))) {
      if (++seen > MAX_CANDIDATES) break;
      if (node.closest(IGNORE_SELECTOR) || !isVisible(node)) continue;

      switch (node.tagName) {
        case 'H1':
        case 'H2':
        case 'H3': {
          const label = short(ownText(node));
          if (!label) break;
          if (node.tagName === 'H1' && !out.pageTitle) out.pageTitle = label;
          out.add('heading', node, { label }, node.tagName === 'H3' ? 1 : 0);
          break;
        }
        case 'INPUT':
          collectInput(node as HTMLInputElement, out);
          break;
        case 'TEXTAREA':
          if (!isSensitive(node)) {
            out.add(
              'textarea',
              node,
              { label: labelFor(node) || undefined, value: clip((node as HTMLTextAreaElement).value, LIMITS.maxText), ...out.common(node) },
              0
            );
          }
          break;
        case 'SELECT':
          collectSelect(node as HTMLSelectElement, out);
          break;
        case 'BUTTON':
          collectButton(node as HTMLButtonElement, out);
          break;
        case 'TABLE':
          collectTable(node as HTMLTableElement, out);
          break;
        default:
          if (node.getAttribute('role') === 'tab') {
            collectTab(node, out);
          } else if (node.getAttribute('role') === 'alert') {
            const text = short(ownText(node));
            if (text) out.add('text', node, { label: 'Alert', value: text }, 1);
          }
      }
    }
  }

  return { pageTitle: out.pageTitle, elements: fitToLimits(out.candidates, envelopeBytes) };
}

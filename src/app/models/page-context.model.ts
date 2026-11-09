/**
 * Visual page context sent to the agent backend in integrated mode.
 *
 * This is a SNAPSHOT of the page the user is looking at. `entities` may identify
 * the current page; the backend uses its scenario_id only when `context` has no
 * scenario selected. The contract is defined by app/schemas.py PageContext; keep
 * both sides in sync with docs/integrated-page-context.md in the agent repo.
 */

export const PAGE_CONTEXT_SCHEMA_VERSION = '1.0';

/** Limits enforced by the backend. The frontend stays under them so a snapshot is never rejected. */
export const PAGE_CONTEXT_LIMITS = {
  /** Backend rejects payloads above 64 KiB; keep a margin for multipart framing. */
  maxBytes: 60 * 1024,
  maxElements: 150,
  maxOptions: 50,
  maxTableRows: 25,
  maxTableColumns: 20,
  /** id, label, option, table cell, title (backend truncates beyond this) */
  maxShortText: 200,
  /** element value */
  maxText: 1000,
  maxRoute: 512
} as const;

export type PageElementType =
  | 'textbox'
  | 'textarea'
  | 'number'
  | 'date'
  | 'checkbox'
  | 'radio'
  | 'switch'
  | 'dropdown'
  | 'multiselect'
  | 'button'
  | 'link'
  | 'tab'
  | 'heading'
  | 'text'
  | 'table'
  | 'list'
  | 'chart'
  | 'image'
  | 'other';

export type PageScalar = string | number | boolean | null;

export interface PageElement {
  id: string;
  type: PageElementType;
  label?: string;
  /** Backend configuration key for scenario parameter controls. */
  param_name?: string;
  /** Text typed in, number, or checkbox/switch state. */
  value?: PageScalar;
  /** Selected option(s) of a dropdown / radio group / multiselect. */
  selected?: string | string[];
  options?: string[];
  /** Defaults to true on the backend: only visible elements are captured, so it is omitted. */
  visible?: boolean;
  /** Defaults to true on the backend: only sent (as false) for disabled elements. */
  enabled?: boolean;
  required?: boolean;
  /** Validation message the UI shows for this element. */
  error?: string;
  /** Form section the element belongs to (fieldset legend). */
  group?: string;
  /** type === 'table': a bounded sample of what is on screen. */
  columns?: string[];
  rows?: PageScalar[][];
  /** Real total when `rows` is a sample. */
  row_count?: number;
  /** type === 'chart': what is plotted; the data points are never captured. */
  chart_type?: string;
  chart_subsystem?: string;
  index_id?: string;
  start_date?: string;
  end_date?: string;
  granularity?: string;
}

export interface PageContextEntities {
  scenario_id?: string;
  proposal_id?: string;
  problem_id?: string;
  active_tab?: string;
  index_id?: string;
  start_date?: string;
  end_date?: string;
  granularity?: string;
  selected_territories?: string[];
}

export interface PageContextPayload {
  schema_version: string;
  captured_at: string;
  /** Router path without query string or fragment (those may carry tokens / personal data). */
  route: string;
  page_title?: string;
  page_description?: string;
  /** Strictly increasing per browser: lets the server drop a snapshot that arrives out of order. */
  revision: number;
  elements: PageElement[];
  entities?: PageContextEntities;
}

/**
 * The integrated assistant is only shown on some sections (admin sections hide it).
 * Page context must never be captured or sent from pages where the assistant is hidden.
 */
export function isIntegratedChatbotPath(url: string): boolean {
  const path = url.split(/[?#]/, 1)[0];
  const section = path.split('/')[1];
  return section !== 'agent' && section !== 'users';
}

import { PAGE_CONTEXT_LIMITS } from '../../models/page-context.model';
import { extractPage } from './page-context-extractor';

describe('extractPage', () => {
  let host: HTMLElement;

  const render = (html: string): ReturnType<typeof extractPage> => {
    host.innerHTML = html;
    return extractPage([host]);
  };
  const byId = (page: ReturnType<typeof extractPage>, id: string) => page.elements.find(e => e.id === id);

  beforeEach(() => {
    host = document.createElement('main');
    document.body.appendChild(host);
  });
  afterEach(() => host.remove());

  it('reads a text box with its <label for>, value, and required flag', () => {
    const page = render(`<label for="name">Proposal name</label><input id="name" type="text" value="New plan" required>`);

    expect(byId(page, 'name')).toEqual({ id: 'name', type: 'textbox', label: 'Proposal name', value: 'New plan', required: true });
  });

  it('keeps an empty field as an empty value (the UI shows it empty)', () => {
    const page = render(`<label for="n">Name</label><input id="n">`);

    expect(byId(page, 'n')?.value).toBe('');
  });

  it('resolves wrapping labels, aria-label, and a sibling label in the same wrapper', () => {
    const page = render(`
      <label>Wrapped <input id="a" value="1"></label>
      <input id="b" aria-label="Aria label" value="2">
      <div class="col"><label class="form-label small">Sibling</label><input id="c" value="3"></div>`);

    expect(byId(page, 'a')?.label).toBe('Wrapped');
    expect(byId(page, 'b')?.label).toBe('Aria label');
    expect(byId(page, 'c')?.label).toBe('Sibling');
  });

  it('reads a native <select>: options, selected option, and ignores a blank placeholder', () => {
    const page = render(`
      <label for="s">Status</label>
      <select id="s"><option value="">--</option><option value="d">Draft</option><option value="r" selected>Under review</option></select>`);

    expect(byId(page, 's')).toEqual({ id: 's', type: 'dropdown', label: 'Status', options: ['--', 'Draft', 'Under review'], selected: 'Under review' });
  });

  it('reads a multiple <select> as multiselect', () => {
    const page = render(`<select id="m" aria-label="Tags" multiple><option selected>A</option><option>B</option><option selected>C</option></select>`);

    expect(byId(page, 'm')).toEqual(jasmine.objectContaining({ type: 'multiselect', selected: ['A', 'C'] }));
  });

  it('groups radios by name into one element with the checked option selected', () => {
    const page = render(`
      <fieldset><legend>Granularity</legend>
        <label><input type="radio" name="g" value="a"> Comunale</label>
        <label><input type="radio" name="g" value="b" checked> Provinciale</label>
      </fieldset>`);

    const radios = page.elements.filter(e => e.type === 'radio');
    expect(radios.length).toBe(1);
    expect(radios[0]).toEqual(jasmine.objectContaining({ label: 'Granularity', options: ['Comunale', 'Provinciale'], selected: 'Provinciale' }));
  });

  it('reads checkboxes and switches as booleans', () => {
    const page = render(`
      <label><input id="c" type="checkbox" checked> Accept</label>
      <div class="form-switch"><input id="w" type="checkbox" role="switch" aria-label="Dark"></div>`);

    expect(byId(page, 'c')).toEqual(jasmine.objectContaining({ type: 'checkbox', value: true }));
    expect(byId(page, 'w')).toEqual(jasmine.objectContaining({ type: 'switch', value: false }));
  });

  it('reads number and date inputs', () => {
    const page = render(`<input id="n" type="number" aria-label="N" value="42"><input id="d" type="date" aria-label="D" value="2026-11-06">`);

    expect(byId(page, 'n')).toEqual(jasmine.objectContaining({ type: 'number', value: 42 }));
    expect(byId(page, 'd')).toEqual(jasmine.objectContaining({ type: 'date', value: '2026-11-06' }));
  });

  it('captures backend parameter keys and page entities without chart data', () => {
    const page = render(`
      <section data-assistant-scenario-id="scenario-7" data-assistant-problem-id="problem-3"
        data-assistant-index-id="tourism-index"
        data-assistant-start-date="2023-01-01"
        data-assistant-end-date="2023-12-31"
        data-assistant-granularity="annuale"
        data-assistant-selected-territories='["Molveno"]'>
        <div data-assistant-active-tab="Parcheggi">
          <label for="parking">Posti auto</label>
          <input id="parking" type="number" data-assistant-param-name="parking_capacity" value="2.5">
        </div>
        <div data-assistant-chart
          data-assistant-chart-index-id="tourism-index"
          data-assistant-chart-label="Indice turistico"
          data-assistant-chart-start-date="2023-01-01"
          data-assistant-chart-end-date="2023-12-31"
          data-assistant-chart-granularity="annuale"></div>
      </section>`);

    expect(page.entities).toEqual({
      scenario_id: 'scenario-7',
      problem_id: 'problem-3',
      active_tab: 'Parcheggi',
      index_id: 'tourism-index',
      start_date: '2023-01-01',
      end_date: '2023-12-31',
      granularity: 'annuale',
      selected_territories: ['Molveno']
    });
    expect(byId(page, 'parking')).toEqual(jasmine.objectContaining({
      label: 'Posti auto',
      param_name: 'parking_capacity',
      value: 2.5
    }));
    const chart = page.elements.find(element => element.type === 'chart');
    expect(chart).toEqual(jasmine.objectContaining({
      index_id: 'tourism-index',
      label: 'Indice turistico',
      start_date: '2023-01-01',
      end_date: '2023-12-31',
      granularity: 'annuale'
    }));
    expect(chart).not.toEqual(jasmine.objectContaining({ value: jasmine.anything() }));
  });

  it('captures scenario plot mode without requiring territorial-index identifiers or plot data', () => {
    const page = render(`
      <div data-assistant-chart
        data-assistant-chart-type="sustainability"
        data-assistant-chart-label="Diagramma di Sostenibilità"
        data-assistant-chart-subsystem="Parcheggi"></div>`);

    expect(page.elements.find(element => element.type === 'chart')).toEqual(
      jasmine.objectContaining({
        chart_type: 'sustainability',
        chart_subsystem: 'Parcheggi',
        label: 'Diagramma di Sostenibilità'
      })
    );
    expect(page.elements.find(element => element.type === 'chart'))
      .not.toEqual(jasmine.objectContaining({ value: jasmine.anything(), rows: jasmine.anything() }));
  });

  it('reads a textarea', () => {
    const page = render(`<label for="t">Description</label><textarea id="t">Line1\nLine2</textarea>`);

    expect(byId(page, 't')).toEqual(jasmine.objectContaining({ type: 'textarea', value: 'Line1\nLine2' }));
  });

  it('reads the custom aria-labelledby dropdown used by the app, including closed-menu options', () => {
    const page = render(`
      <label id="lbl-g">Granularità territoriale</label>
      <div class="dropdown">
        <button id="gran" type="button" data-bs-toggle="dropdown" aria-labelledby="lbl-g" aria-haspopup="true">
          <span>Comunale</span><span class="material-icons" aria-hidden="true">expand_more</span>
        </button>
        <div class="dropdown-menu" style="display:none"><ul>
          <li><a>Comunale</a></li><li><a>Macro area</a></li><li><a>Provincia</a></li>
        </ul></div>
      </div>`);

    expect(byId(page, 'gran')).toEqual({
      id: 'gran', type: 'dropdown', label: 'Granularità territoriale', selected: 'Comunale',
      options: ['Comunale', 'Macro area', 'Provincia']
    });
    // its menu items are options, not buttons
    expect(page.elements.filter(e => e.type === 'button').length).toBe(0);
  });

  it('reports buttons with enabled=false only when disabled, and ignores icon text', () => {
    const page = render(`
      <button id="save" disabled><span class="material-icons">save</span> Save</button>
      <button id="ok">OK</button>`);

    expect(byId(page, 'save')).toEqual({ id: 'save', type: 'button', label: 'Save', enabled: false });
    expect(byId(page, 'ok')).toEqual({ id: 'ok', type: 'button', label: 'OK' });
  });

  it('reads tabs with their selected state and headings with the first h1 as page title', () => {
    const page = render(`
      <h1>Edit proposal</h1><h2>Details</h2>
      <button role="tab" id="t1" aria-selected="true">General</button>
      <button role="tab" id="t2" aria-selected="false">Budget</button>`);

    expect(page.pageTitle).toBe('Edit proposal');
    expect(page.elements.filter(e => e.type === 'heading').map(e => e.label)).toEqual(['Edit proposal', 'Details']);
    expect(byId(page, 't1')?.value).toBe(true);
    expect(byId(page, 't2')?.value).toBe(false);
  });

  it('reads a data table: columns, a bounded row sample, and the real row count', () => {
    const rows = Array.from({ length: 40 }, (_, i) => `<tr><td>Task ${i}</td><td>Owner ${i}</td></tr>`).join('');
    const page = render(`<table id="tasks" aria-label="Tasks"><thead><tr><th>Name</th><th>Owner</th></tr></thead><tbody>${rows}</tbody></table>`);
    const table = byId(page, 'tasks')!;

    expect(table.type).toBe('table');
    expect(table.columns).toEqual(['Name', 'Owner']);
    expect(table.rows!.length).toBe(PAGE_CONTEXT_LIMITS.maxTableRows);
    expect(table.rows![0]).toEqual(['Task 0', 'Owner 0']);
    expect(table.row_count).toBe(40);
  });

  it('reads a key/value (borderless) table without a header', () => {
    const page = render(`<table id="kv"><tbody><tr><th>Status</th><td>Under review</td></tr><tr><th>Owner</th><td>Ann</td></tr></tbody></table>`);

    expect(byId(page, 'kv')).toEqual({ id: 'kv', type: 'table', rows: [['Status', 'Under review'], ['Owner', 'Ann']] });
  });

  it('labels an input inside a key/value table from its row header', () => {
    const page = render(`<table><tbody><tr><th>Title</th><td><input id="ti" value="x"></td></tr></tbody></table>`);

    expect(byId(page, 'ti')?.label).toBe('Title');
  });

  it('skips row-action buttons inside data tables', () => {
    const page = render(`<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1 <button>Delete</button></td></tr></tbody></table><button>New</button>`);

    expect(page.elements.filter(e => e.type === 'button').map(e => e.label)).toEqual(['New']);
  });

  it('reports validation errors shown by the UI', () => {
    const page = render(`
      <label for="e">Email</label><input id="e" class="is-invalid" value="x" aria-describedby="e-err">
      <div id="e-err">Invalid email</div>
      <input id="f" aria-label="F" aria-invalid="true" value="y">`);

    expect(byId(page, 'e')?.error).toBe('Invalid email');
    expect(byId(page, 'f')?.error).toBe('Marked as invalid');
  });

  it('reads role=alert text', () => {
    const page = render(`<div role="alert">Saving failed</div>`);

    expect(page.elements[0]).toEqual(jasmine.objectContaining({ type: 'text', label: 'Alert', value: 'Saving failed' }));
  });

  // ─── privacy ─────────────────────────────────────────────────────────────
  it('never captures passwords, hidden/file inputs or secret-looking fields', () => {
    const page = render(`
      <input type="password" id="pw" value="hunter2">
      <input type="hidden" id="h" value="csrf">
      <input type="file" id="f">
      <input id="api_token" value="abc">
      <input id="x" name="cvv" value="123">
      <input id="y" autocomplete="cc-number" value="4111">
      <input id="ok" aria-label="Fine" value="visible">`);

    expect(page.elements.map(e => e.id)).toEqual(['ok']);
    expect(JSON.stringify(page)).not.toContain('hunter2');
  });

  it('honours data-assistant-ignore and never reads the chatbot widget', () => {
    const page = render(`
      <div data-assistant-ignore><input id="p" aria-label="Private" value="secret"></div>
      <app-chatbot-integrated><textarea id="chat" aria-label="Chat">my question</textarea></app-chatbot-integrated>
      <input id="pub" aria-label="Public" value="ok">`);

    expect(page.elements.map(e => e.id)).toEqual(['pub']);
  });

  it('skips elements that are not rendered', () => {
    const page = render(`
      <input id="a" aria-label="A" hidden>
      <div style="display:none"><input id="b" aria-label="B"></div>
      <input id="c" aria-label="C" style="visibility:hidden">
      <input id="d" aria-label="D">`);

    expect(page.elements.map(e => e.id)).toEqual(['d']);
  });

  it('does not duplicate content when roots are nested', () => {
    host.innerHTML = `<div id="dlg" role="dialog" aria-modal="true"><input id="i" aria-label="I"></div>`;
    const page = extractPage([host, host.querySelector('#dlg')!]);

    expect(page.elements.filter(e => e.id === 'i').length).toBe(1);
  });

  // ─── limits ──────────────────────────────────────────────────────────────
  it('gives every element a unique id, even without id/name', () => {
    const page = render(`<input aria-label="A"><input aria-label="B"><input id="x" aria-label="C"><input id="x" aria-label="D">`);
    const ids = page.elements.map(e => e.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('truncates long values and caps options', () => {
    const options = Array.from({ length: 80 }, (_, i) => `<option>Option ${i}</option>`).join('');
    const page = render(`<textarea id="t" aria-label="T">${'x'.repeat(5000)}</textarea><select id="s" aria-label="S">${options}</select>`);

    expect((byId(page, 't')!.value as string).length).toBeLessThanOrEqual(PAGE_CONTEXT_LIMITS.maxText);
    expect(byId(page, 's')!.options!.length).toBe(PAGE_CONTEXT_LIMITS.maxOptions);
  });

  it('keeps form controls and drops plain buttons first when over the element cap', () => {
    const buttons = Array.from({ length: 300 }, (_, i) => `<button>Button ${i}</button>`).join('');
    const page = render(`${buttons}<input id="keep" aria-label="Keep" value="v"><h2>Title</h2>`);

    expect(page.elements.length).toBeLessThanOrEqual(PAGE_CONTEXT_LIMITS.maxElements);
    expect(byId(page, 'keep')).toBeTruthy();
    expect(page.elements.some(e => e.type === 'heading')).toBe(true);
  });

  it('stays under the byte budget on a very large page', () => {
    const fields = Array.from({ length: 140 }, (_, i) => `<textarea aria-label="Field ${i}">${'ü'.repeat(900)}</textarea>`).join('');
    const page = render(fields);
    const bytes = new TextEncoder().encode(JSON.stringify(page.elements)).length;

    expect(bytes).toBeLessThanOrEqual(PAGE_CONTEXT_LIMITS.maxBytes);
    expect(page.elements.length).toBeGreaterThan(0);
  });

  it('produces JSON the backend accepts: only known keys and types', () => {
    const page = render(`<label for="a">A</label><input id="a" value="1"><button>Go</button><table><tbody><tr><td>1</td></tr></tbody></table>`);
    const allowed = new Set(['id', 'type', 'label', 'value', 'selected', 'options', 'visible', 'enabled', 'required', 'error', 'group', 'columns', 'rows', 'row_count']);

    for (const element of page.elements) {
      Object.keys(element).forEach(key => expect(allowed.has(key)).toBe(true));
    }
  });
});

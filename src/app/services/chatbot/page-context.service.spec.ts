import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { PageContextService } from './page-context.service';

describe('PageContextService', () => {
  let service: PageContextService;
  let router: { url: string };
  let main: HTMLElement;

  beforeEach(() => {
    router = { url: '/proposals/edit/123' };
    TestBed.configureTestingModule({ providers: [PageContextService, { provide: Router, useValue: router }] });
    service = TestBed.inject(PageContextService);
    main = document.createElement('main');
    document.body.appendChild(main);
  });
  afterEach(() => {
    main.remove();
    document.querySelectorAll('[data-test-dialog]').forEach(node => node.remove());
  });

  it('uses the router path without query string or fragment', () => {
    router.url = '/problems/7?token=secret&x=1#section';

    expect(service.currentRoute()).toBe('/problems/7');
  });

  it('issues strictly increasing revisions, even within the same millisecond', () => {
    spyOn(Date, 'now').and.returnValue(1_800_000_000_000);

    const revisions = [service.nextRevision(), service.nextRevision(), service.nextRevision()];

    expect(revisions).toEqual([1_800_000_000_000, 1_800_000_000_001, 1_800_000_000_002]);
  });

  it('captures the backend contract shape from the rendered page', () => {
    main.innerHTML = `<h1>Edit proposal</h1><label for="n">Proposal name</label><input id="n" value="New infrastructure plan"><button disabled>Save</button>`;

    const snapshot = service.capture();

    expect(snapshot.schema_version).toBe('1.0');
    expect(new Date(snapshot.captured_at).toISOString()).toBe(snapshot.captured_at);
    expect(snapshot.route).toBe('/proposals/edit/123');
    expect(snapshot.page_title).toBe('Edit proposal');
    expect(Number.isInteger(snapshot.revision)).toBe(true);
    expect(snapshot.elements).toEqual([
      { id: 'heading-1', type: 'heading', label: 'Edit proposal' },
      { id: 'n', type: 'textbox', label: 'Proposal name', value: 'New infrastructure plan' },
      { id: 'button-2', type: 'button', label: 'Save', enabled: false }
    ]);
  });

  it('captures route-backed scenario IDs, active tab, and parameter names', () => {
    router.url = '/problems/problem-3/proposals/proposal-5/scenari/scenario-7';
    main.innerHTML = `
      <section data-assistant-problem-id="problem-3"
        data-assistant-proposal-id="proposal-5"
        data-assistant-scenario-id="scenario-7">
        <div data-assistant-active-tab="Parcheggi">
          <label for="p">Posti auto</label>
          <input id="p" type="number" data-assistant-param-name="parking_capacity" value="2.5">
        </div>
      </section>`;

    const snapshot = service.capture();

    expect(snapshot.route).toBe('/problems/problem-3/proposals/proposal-5/scenari/scenario-7');
    expect(snapshot.entities).toEqual({
      problem_id: 'problem-3',
      proposal_id: 'proposal-5',
      scenario_id: 'scenario-7',
      active_tab: 'Parcheggi'
    });
    expect(snapshot.elements).toContain(jasmine.objectContaining({
      label: 'Posti auto',
      param_name: 'parking_capacity',
      value: 2.5
    }));
  });

  it('falls back to the document title when the page has no <h1>', () => {
    document.title = 'Territorial indexes';
    main.innerHTML = `<button>Go</button>`;

    expect(service.capture().page_title).toBe('Territorial indexes');
  });

  it('includes an open dialog rendered outside <main>, but not closed ones', () => {
    const open = document.createElement('div');
    open.setAttribute('data-test-dialog', '');
    open.setAttribute('role', 'dialog');
    open.setAttribute('aria-modal', 'true');
    open.innerHTML = `<input id="in-dialog" aria-label="Dialog field" value="x">`;
    const closed = document.createElement('div');
    closed.setAttribute('data-test-dialog', '');
    closed.innerHTML = `<input id="in-closed" aria-label="Closed" value="y">`;
    document.body.append(open, closed);

    const ids = service.capture().elements.map(e => e.id);

    expect(ids).toContain('in-dialog');
    expect(ids).not.toContain('in-closed');
  });

  it('never includes content outside <main> (header, chatbot widget)', () => {
    const outside = document.createElement('div');
    outside.setAttribute('data-test-dialog', '');
    outside.innerHTML = `<textarea id="chat-input" aria-label="Chat">private question</textarea>`;
    document.body.appendChild(outside);
    main.innerHTML = `<input id="page" aria-label="Page" value="p">`;

    expect(service.capture().elements.map(e => e.id)).toEqual(['page']);
  });

  describe('whenSettled', () => {
    it('resolves after the page has been quiet', async () => {
      const started = Date.now();
      await service.whenSettled(40, 1000);

      expect(Date.now() - started).toBeGreaterThanOrEqual(35);
      expect(Date.now() - started).toBeLessThan(500);
    });

    it('waits while the page keeps changing, then resolves once it is quiet', async () => {
      const started = Date.now();
      const settled = service.whenSettled(60, 2000);
      for (let i = 0; i < 4; i++) {
        await new Promise(resolve => setTimeout(resolve, 30));
        main.appendChild(document.createElement('span')); // data arriving
      }
      await settled;

      expect(Date.now() - started).toBeGreaterThanOrEqual(120 + 55);
    });

    it('gives up after maxMs on a page that never stops changing', async () => {
      const timer = setInterval(() => main.appendChild(document.createElement('i')), 10);
      const started = Date.now();
      await service.whenSettled(200, 150);
      clearInterval(timer);

      expect(Date.now() - started).toBeLessThan(400);
    });
  });
});

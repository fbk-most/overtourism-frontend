import { DOCUMENT } from '@angular/core';
import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { PageContextPayload, PageElement } from '../../models/page-context.model';
import { AgentService } from '../agent.service';
import {
  describePageChange,
  PAGE_CHANGE_TEXT,
  PageChange,
  PageContextSyncService
} from './page-context-sync.service';
import { PageContextService } from './page-context.service';

describe('PageContextSyncService', () => {
  let events: Subject<unknown>;
  let settles: Array<() => void>;
  let pushed: PageContextPayload[];
  let sync: PageContextSyncService;
  let whenSettledCalls: number;
  let route: string;
  let elements: PageElement[];
  let fakeDocument: Document;
  let changes: PageChange[];

  const navigate = (url: string) => {
    route = url.split(/[?#]/, 1)[0];
    events.next(new NavigationEnd(1, url, url));
  };
  const settleOldest = () => settles.shift()?.();
  const settleAll = () => {
    const pending = settles.splice(0);
    pending.forEach(resolve => resolve());
  };

  beforeEach(() => {
    events = new Subject();
    settles = [];
    pushed = [];
    changes = [];
    whenSettledCalls = 0;
    route = '/';
    elements = [{ id: 'idx', type: 'dropdown', label: 'Indice', selected: 'A' }];
    fakeDocument = document.implementation.createHTMLDocument('fake');

    TestBed.configureTestingModule({
      providers: [
        PageContextSyncService,
        { provide: Router, useValue: { events } },
        { provide: DOCUMENT, useValue: fakeDocument },
        {
          provide: PageContextService,
          useValue: {
            currentRoute: () => route,
            capture: (): PageContextPayload => ({
              schema_version: '1.0',
              captured_at: new Date().toISOString(),
              route,
              revision: pushed.length + 1,
              elements: elements.map(element => ({ ...element }))
            }),
            whenSettled: () => {
              whenSettledCalls++;
              return new Promise<void>(resolve => settles.push(resolve));
            }
          }
        },
        {
          provide: AgentService,
          useValue: {
            updatePageContext: (snapshot: PageContextPayload) => {
              pushed.push(snapshot);
              return Promise.resolve();
            }
          }
        }
      ]
    });
    sync = TestBed.inject(PageContextSyncService);
    sync.changes$.subscribe(change => changes.push(change));
    sync.start();
  });
  afterEach(() => sync.stop());

  it('sends the context once the page has settled after a navigation', fakeAsync(() => {
    navigate('/proposals/edit/123');
    flushMicrotasks();
    expect(pushed.length).toBe(0); // not before the page has rendered

    settleOldest();
    flushMicrotasks();
    expect(pushed.length).toBe(1);
  }));

  it('only sends for the latest of several close navigations', fakeAsync(() => {
    navigate('/a');
    navigate('/b');
    navigate('/c');
    flushMicrotasks();
    expect(whenSettledCalls).toBe(3);

    settleAll(); // all three pages "settle", in arrival order
    flushMicrotasks();

    expect(pushed.length).toBe(1);
  }));

  it('does not capture on pages where the assistant is hidden, and cancels a pending capture', fakeAsync(() => {
    navigate('/users');
    navigate('/agent/stats');
    flushMicrotasks();
    expect(whenSettledCalls).toBe(0);

    navigate('/problems/1');
    navigate('/users/42?tab=roles'); // leaves before the first page settled
    settleOldest();
    flushMicrotasks();
    expect(pushed.length).toBe(0);
  }));

  it('ignores router events other than NavigationEnd', fakeAsync(() => {
    events.next(new NavigationStart(1, '/a'));
    flushMicrotasks();

    expect(whenSettledCalls).toBe(0);
  }));

  it('start() is idempotent and stop() unsubscribes', fakeAsync(() => {
    sync.start();
    sync.start();
    navigate('/a');
    flushMicrotasks();
    expect(whenSettledCalls).toBe(1); // not 3

    sync.stop();
    navigate('/b');
    flushMicrotasks();
    expect(whenSettledCalls).toBe(1);
  }));

  describe('page change events', () => {
    const firstPage = () => {
      navigate('/indici');
      settleAll();
      flushMicrotasks();
    };

    it('stays silent for the first page (e.g. right after a refresh)', fakeAsync(() => {
      firstPage();
      expect(changes).toEqual([]);
    }));

    it('reports a navigation to another page, with the route as hint', fakeAsync(() => {
      firstPage();
      navigate('/problems');
      settleAll();
      flushMicrotasks();

      expect(changes.length).toBe(1);
      expect(changes[0].text).toBe(`${PAGE_CHANGE_TEXT} · /problems`);
      expect(pushed.length).toBe(2);
    }));

    it('reports a filter change on the same route after the page settled, and pushes it', fakeAsync(() => {
      firstPage();
      elements = [{ id: 'idx', type: 'dropdown', label: 'Indice', selected: 'B' }];
      fakeDocument.dispatchEvent(new Event('change'));
      flushMicrotasks();
      expect(changes.length).toBe(0); // waits for the page to settle

      settleAll();
      flushMicrotasks();
      expect(changes.map(c => c.text)).toEqual([`${PAGE_CHANGE_TEXT} · Indice: A → B`]);
      expect(pushed.length).toBe(2);
      expect(pushed[1].elements[0].selected).toBe('B');
    }));

    it('does not report (nor push) an interaction that changed nothing', fakeAsync(() => {
      firstPage();
      fakeDocument.dispatchEvent(new Event('click'));
      settleAll();
      flushMicrotasks();

      expect(changes).toEqual([]);
      expect(pushed.length).toBe(1);
    }));

    it('ignores interactions inside the assistant itself', fakeAsync(() => {
      firstPage();
      const widget = fakeDocument.createElement('app-chatbot-integrated');
      const button = fakeDocument.createElement('button');
      widget.appendChild(button);
      fakeDocument.body.appendChild(widget);
      const before = whenSettledCalls;

      button.dispatchEvent(new Event('click', { bubbles: true }));
      expect(whenSettledCalls).toBe(before);
    }));

    it('flush() reports a pending change synchronously and always sends the current page', fakeAsync(() => {
      firstPage();
      elements = [{ id: 'idx', type: 'dropdown', label: 'Indice', selected: 'C' }];

      void sync.flush();
      expect(changes.length).toBe(1); // drawn before the caller adds the user's message
      flushMicrotasks();
      expect(pushed.length).toBe(2);

      void sync.flush(); // nothing changed: no new event, but the backend still gets the page
      flushMicrotasks();
      expect(changes.length).toBe(1);
      expect(pushed.length).toBe(3);
    }));
  });
});

describe('describePageChange', () => {
  const state = (elements: PageElement[], route = '/indici') => ({ route, elements });

  it('describes a changed form value', () => {
    const before = state([{ id: 'a', type: 'dropdown', label: 'Indice', selected: 'X' }]);
    const after = state([{ id: 'a', type: 'dropdown', label: 'Indice', selected: 'Y' }]);
    expect(describePageChange(before, after)).toBe('Indice: X → Y');
  });

  it('reports the newly selected tab only', () => {
    const before = state([
      { id: 't1', type: 'tab', label: 'Mappa', value: true },
      { id: 't2', type: 'tab', label: 'Grafici', value: false }
    ]);
    const after = state([
      { id: 't1', type: 'tab', label: 'Mappa', value: false },
      { id: 't2', type: 'tab', label: 'Grafici', value: true }
    ]);
    expect(describePageChange(before, after)).toBe('Scheda: Grafici');
  });

  it('caps the number of items and returns nothing for unexplained differences', () => {
    const many = (suffix: string) =>
      state(Array.from({ length: 5 }, (_, i) => ({ id: `n${i}`, type: 'number' as const, label: `F${i}`, value: suffix })));
    expect(describePageChange(many('1'), many('2'))).toContain('(+2)');
    expect(describePageChange(state([]), state([{ id: 'h', type: 'heading', label: 'Nuovo' }]))).toBe('');
  });
});

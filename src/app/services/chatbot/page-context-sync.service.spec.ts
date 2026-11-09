import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AgentService } from '../agent.service';
import { PageContextSyncService } from './page-context-sync.service';
import { PageContextService } from './page-context.service';

describe('PageContextSyncService', () => {
  let events: Subject<unknown>;
  let settles: Array<() => void>;
  let updates: number;
  let sync: PageContextSyncService;
  let whenSettledCalls: number;

  const navigate = (url: string) => events.next(new NavigationEnd(1, url, url));
  const settleOldest = () => settles.shift()?.();

  beforeEach(() => {
    events = new Subject();
    settles = [];
    updates = 0;
    whenSettledCalls = 0;
    TestBed.configureTestingModule({
      providers: [
        PageContextSyncService,
        { provide: Router, useValue: { events } },
        {
          provide: PageContextService,
          useValue: {
            whenSettled: () => {
              whenSettledCalls++;
              return new Promise<void>(resolve => settles.push(resolve));
            }
          }
        },
        { provide: AgentService, useValue: { updatePageContext: () => { updates++; return Promise.resolve(); } } }
      ]
    });
    sync = TestBed.inject(PageContextSyncService);
    sync.start();
  });
  afterEach(() => sync.stop());

  it('sends the context once the page has settled after a navigation', fakeAsync(() => {
    navigate('/proposals/edit/123');
    flushMicrotasks();
    expect(updates).toBe(0); // not before the page has rendered

    settleOldest();
    flushMicrotasks();
    expect(updates).toBe(1);
  }));

  it('only sends for the latest of several close navigations', fakeAsync(() => {
    navigate('/a');
    navigate('/b');
    navigate('/c');
    flushMicrotasks();
    expect(whenSettledCalls).toBe(3);

    settles.forEach(resolve => resolve()); // all three pages "settle", in arrival order
    flushMicrotasks();

    expect(updates).toBe(1);
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
    expect(updates).toBe(0);
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
});

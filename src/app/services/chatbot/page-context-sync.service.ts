import { DOCUMENT, Inject, Injectable, NgZone } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { EMPTY, filter, from, Observable, Subject, Subscription, switchMap } from 'rxjs';
import {
  isIntegratedChatbotPath,
  PageContextPayload,
  PageElement
} from '../../models/page-context.model';
import { AgentService } from '../agent.service';
import { PageContextService } from './page-context.service';

/** Text drawn in the integrated chat when the page the user is looking at changes. */
export const PAGE_CHANGE_TEXT = 'Cambiamento pagina rilevato';

/** Emitted when the visible page changed (navigation, filter, tab, form value, new data...). */
export interface PageChange {
  /** Ready-to-draw text: PAGE_CHANGE_TEXT, plus a short hint of what changed when it can be told. */
  text: string;
}

/** The part of a snapshot that says what the page shows (no timestamps / revision). */
interface PageState {
  route: string;
  title?: string;
  entities?: PageContextPayload['entities'];
  elements: PageElement[];
}

const MAX_DETAIL_ITEMS = 3;
const MAX_DETAIL_CHARS = 160;

function stateOf(snapshot: PageContextPayload): PageState {
  return {
    route: snapshot.route,
    title: snapshot.page_title,
    entities: snapshot.entities,
    elements: snapshot.elements
  };
}

function shown(element: PageElement): string {
  const value = element.selected ?? element.value;
  if (Array.isArray(value)) return value.join(', ') || '—';
  if (typeof value === 'boolean') return value ? 'attivo' : 'non attivo';
  return value === undefined || value === null || value === '' ? '—' : String(value);
}

function trim(text: string, limit: number): string {
  return text.length > limit ? text.slice(0, limit - 1) + '…' : text;
}

/**
 * Short, human-readable hint of what changed between two states of the page. Best effort: it only
 * has to help the user reconstruct the conversation, so unknown differences yield no hint.
 */
export function describePageChange(previous: PageState, next: PageState): string {
  if (previous.route !== next.route) {
    return trim(next.title || next.route, MAX_DETAIL_CHARS);
  }

  const before = new Map(previous.elements.map(element => [element.id, element]));
  const items: string[] = [];
  for (const element of next.elements) {
    const old = before.get(element.id);
    if (!old || JSON.stringify(old) === JSON.stringify(element)) continue;
    const name = element.label || element.id;

    switch (element.type) {
      case 'tab':
        if (element.value === true && old.value !== true) items.push(`Scheda: ${name}`);
        break;
      case 'chart':
        items.push(`Grafico aggiornato: ${name}`);
        break;
      case 'table':
        items.push(`Tabella aggiornata: ${name}`);
        break;
      case 'heading':
      case 'text':
        break;
      default:
        if (shown(old) !== shown(element)) items.push(`${name}: ${shown(old)} → ${shown(element)}`);
    }
  }

  if (items.length === 0) return '';
  const extra = items.length - MAX_DETAIL_ITEMS;
  const detail = items.slice(0, MAX_DETAIL_ITEMS).join('; ') + (extra > 0 ? ` (+${extra})` : '');
  return trim(detail, MAX_DETAIL_CHARS);
}

/** Clicks/typing inside these are never page changes (it is the assistant's own UI). */
const IGNORED_ORIGIN = 'app-chatbot-integrated, app-chatbot-standalone, [data-assistant-ignore]';

/** User interactions after which the page may have changed (value properties do not mutate the DOM). */
const INTERACTION_EVENTS = ['change', 'input', 'click'] as const;

/**
 * Keeps the agent's visual page context in step with what the user sees, and tells the integrated
 * chat when the page changed.
 *
 * Lives at root (started by AppComponent) rather than inside the chatbot component: that
 * component is created and destroyed with the route and would miss changes.
 *
 * Page changes are detected from route navigation AND from user interaction / DOM updates on the
 * routed page (e.g. picking another index on a page with filters does not navigate anywhere). A
 * change is reported once the page has stopped changing. On every detected change the fresh snapshot
 * is also sent to the backend, and `flush()` guarantees a fresh snapshot right before a message.
 */
@Injectable({ providedIn: 'root' })
export class PageContextSyncService {
  private readonly changesSubject = new Subject<PageChange>();
  /** Page changes, for the chat to draw. Local only: nothing here is sent to the backend. */
  readonly changes$: Observable<PageChange> = this.changesSubject.asObservable();

  private subscription?: Subscription;
  private baseline: PageState | null = null;
  private baselineKey = '';
  private checking = false;
  private checkAgain = false;
  private removeListeners: Array<() => void> = [];

  constructor(
    private router: Router,
    private pageContext: PageContextService,
    private agent: AgentService,
    private zone: NgZone,
    @Inject(DOCUMENT) private document: Document
  ) {}

  start(): void {
    if (this.subscription) return;
    this.subscription = this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        // switchMap: a newer navigation cancels the pending capture of the previous one, and so does
        // navigating to a page where the assistant is hidden (nothing is captured there).
        switchMap(event => {
          if (isIntegratedChatbotPath(event.urlAfterRedirects)) {
            return from(this.pageContext.whenSettled());
          }
          this.baseline = null;
          this.baselineKey = '';
          return EMPTY;
        })
      )
      .subscribe(() => this.sync(true));
    this.watchPage();
  }

  stop(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    this.removeListeners.forEach(remove => remove());
    this.removeListeners = [];
    this.baseline = null;
    this.baselineKey = '';
  }

  /**
   * Call right before sending a chat message: reports a change the user made a moment ago (the
   * chat draws it synchronously, i.e. before the message the caller is about to add) and resolves
   * once the backend has the page exactly as it is now.
   */
  flush(): Promise<void> {
    return this.sync(true);
  }

  /**
   * Captures the page, reports it when it differs from the previous capture and sends it to the
   * backend (only when it changed, or when `forcePush`). The comparison and the event happen
   * synchronously; the returned promise only covers the network call.
   */
  private sync(forcePush: boolean): Promise<void> {
    if (!isIntegratedChatbotPath(this.pageContext.currentRoute())) {
      this.baseline = null;
      this.baselineKey = '';
      return Promise.resolve();
    }

    let snapshot: PageContextPayload;
    try {
      snapshot = this.pageContext.capture();
    } catch (error) {
      console.warn('Page context capture failed', error instanceof Error ? error.name : 'error');
      return Promise.resolve();
    }

    const next = stateOf(snapshot);
    const key = JSON.stringify(next);
    const previous = this.baseline;
    const changed = previous !== null && key !== this.baselineKey;
    this.baseline = next;
    this.baselineKey = key;

    if (changed && previous) {
      const detail = describePageChange(previous, next);
      this.zone.run(() =>
        this.changesSubject.next({ text: detail ? `${PAGE_CHANGE_TEXT} · ${detail}` : PAGE_CHANGE_TEXT })
      );
    }
    return changed || forcePush ? this.agent.updatePageContext(snapshot) : Promise.resolve();
  }

  /** Coalesces bursts of interaction/DOM activity into one check after the page settled. */
  private scheduleCheck(): void {
    if (this.checking) {
      this.checkAgain = true;
      return;
    }
    this.checking = true;
    void this.pageContext
      .whenSettled(500, 2500)
      .then(() => this.sync(false))
      .catch(() => undefined)
      .finally(() => {
        this.checking = false;
        if (this.checkAgain) {
          this.checkAgain = false;
          this.scheduleCheck();
        }
      });
  }

  private watchPage(): void {
    const doc = this.document;
    // Outside Angular: these fire constantly and must not trigger change detection by themselves.
    this.zone.runOutsideAngular(() => {
      const onInteraction = (event: Event): void => {
        const target = event.target;
        if (target instanceof Element && target.closest(IGNORED_ORIGIN)) return;
        if (this.baseline) this.scheduleCheck();
      };
      for (const name of INTERACTION_EVENTS) {
        doc.addEventListener(name, onInteraction, true);
        this.removeListeners.push(() => doc.removeEventListener(name, onInteraction, true));
      }

      // Data arriving after an interaction (or without one): the routed page re-renders. Observed on
      // <body> because <main> only exists once the user is logged in; the assistant's own DOM is skipped.
      if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(records => {
          if (!this.baseline) return;
          const external = records.some(record => {
            const node = record.target instanceof Element ? record.target : record.target.parentElement;
            return !node?.closest(IGNORED_ORIGIN);
          });
          if (external) this.scheduleCheck();
        });
        observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
        this.removeListeners.push(() => observer.disconnect());
      }
    });
  }
}

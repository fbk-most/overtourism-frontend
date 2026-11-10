
import { Inject, Injectable, NgZone, DOCUMENT } from '@angular/core';
import { Router } from '@angular/router';
import {
  PAGE_CONTEXT_LIMITS,
  PAGE_CONTEXT_SCHEMA_VERSION,
  PageContextPayload
} from '../../models/page-context.model';
import { AuthenticationService } from '../authentication.service';
import { extractPage } from './page-context-extractor';

/**
 * Builds the visual page context: a snapshot of the page the user is currently looking at.
 * It never talks to the backend (AgentService does). ChatbotContextService still supplies the
 * business context; this snapshot separately captures page identifiers for tool lookup.
 */
@Injectable({ providedIn: 'root' })
export class PageContextService {
  private lastRevision = 0;

  constructor(
    private router: Router,
    private zone: NgZone,
    @Inject(DOCUMENT) private document: Document,
    private authService: AuthenticationService
  ) {}

  /** Router path without query string or fragment (those may carry tokens or personal data). */
  currentRoute(): string {
    const path = this.router.url.split(/[?#]/, 1)[0] || '/';
    return path.slice(0, PAGE_CONTEXT_LIMITS.maxRoute);
  }

  /**
   * Strictly increasing per browser. Epoch milliseconds, so it also keeps increasing across page
   * reloads (the chat session survives a reload) without storing anything.
   */
  nextRevision(): number {
    this.lastRevision = Math.max(Date.now(), this.lastRevision + 1);
    return this.lastRevision;
  }

  /** Snapshot of the page as it is right now. */
  capture(): PageContextPayload {
    const { pageTitle, elements, entities: extractedEntities } = extractPage(this.roots());
    const territory = this.authService.activeTerritory;
    const entities = {
      ...(extractedEntities ?? {}),
      ...(territory ? { territory } : {})
    };
    const title = (pageTitle ?? this.document.title ?? '').replace(/\s+/g, ' ').trim();
    return {
      schema_version: PAGE_CONTEXT_SCHEMA_VERSION,
      captured_at: new Date().toISOString(),
      route: this.currentRoute(),
      ...(title ? { page_title: title.slice(0, PAGE_CONTEXT_LIMITS.maxShortText) } : {}),
      revision: this.nextRevision(),
      elements,
      ...(Object.keys(entities).length ? { entities } : {})
    };
  }

  /**
   * Resolves once the page has stopped changing for `quietMs` (data loaded, views rendered), or
   * after `maxMs` at the latest. NavigationEnd fires before the routed component has rendered and
   * before its data arrives, so capturing immediately would describe an empty page.
   */
  whenSettled(quietMs = 350, maxMs = 2500): Promise<void> {
    const root = this.mainRoot();
    return this.zone.runOutsideAngular(
      () =>
        new Promise<void>(resolve => {
          let quietTimer: ReturnType<typeof setTimeout> | undefined;
          let maxTimer: ReturnType<typeof setTimeout> | undefined;
          const observer = new MutationObserver(() => {
            if (quietTimer) clearTimeout(quietTimer);
            quietTimer = setTimeout(finish, quietMs);
          });
          const finish = (): void => {
            observer.disconnect();
            if (quietTimer) clearTimeout(quietTimer);
            if (maxTimer) clearTimeout(maxTimer);
            resolve();
          };
          observer.observe(root, { childList: true, subtree: true, characterData: true });
          quietTimer = setTimeout(finish, quietMs);
          maxTimer = setTimeout(finish, maxMs);
        })
    );
  }

  private mainRoot(): Element {
    return this.document.querySelector('main') ?? this.document.body;
  }

  /** The routed page plus any open dialog (dialogs are rendered outside <main>). */
  private roots(): Element[] {
    const dialogs = Array.from(this.document.querySelectorAll('[role="dialog"][aria-modal="true"], .modal.show'));
    return [this.mainRoot(), ...dialogs];
  }
}

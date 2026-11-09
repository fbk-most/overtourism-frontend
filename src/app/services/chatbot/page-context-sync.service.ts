import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { EMPTY, filter, from, Subscription, switchMap } from 'rxjs';
import { isIntegratedChatbotPath } from '../../models/page-context.model';
import { AgentService } from '../agent.service';
import { PageContextService } from './page-context.service';

/**
 * Keeps the agent's visual page context in step with Angular route navigation.
 *
 * Lives at root (started by AppComponent) rather than inside the chatbot component: that
 * component is created and destroyed with *ngIf and would miss navigations.
 *
 * The context is deliberately NOT refreshed when the user edits form controls; it is sent at
 * conversation start (AgentService.init) and on navigation only.
 */
@Injectable({ providedIn: 'root' })
export class PageContextSyncService {
  private subscription?: Subscription;

  constructor(
    private router: Router,
    private pageContext: PageContextService,
    private agent: AgentService
  ) {}

  start(): void {
    if (this.subscription) return;
    this.subscription = this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        // switchMap: a newer navigation cancels the pending capture of the previous one, and so does
        // navigating to a page where the assistant is hidden (nothing is captured there).
        switchMap(event =>
          isIntegratedChatbotPath(event.urlAfterRedirects) ? from(this.pageContext.whenSettled()) : EMPTY
        )
      )
      .subscribe(() => void this.agent.updatePageContext());
  }

  stop(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
  }
}

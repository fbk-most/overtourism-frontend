import { Component, OnInit } from '@angular/core';
import { AuthenticationService } from './services/authentication.service';
import { NavigationEnd, Router } from '@angular/router';
import { isIntegratedChatbotPath } from './models/page-context.model';
import { PageContextSyncService } from './services/chatbot/page-context-sync.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false,
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  sidebarCollapsed = false;
  isMobile = false;
  showTerritoryReference = false;
  showIntegratedChatbot = true;

  constructor(public authService: AuthenticationService,
    private router: Router,
    private pageContextSync: PageContextSyncService
  ) {

  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  ngOnInit() {
    this.isMobile = window.innerWidth < 768;
    window.addEventListener('resize', () => {
      this.isMobile = window.innerWidth < 768;
    });
    this.updateRouteVisibility(this.router.url);
    // Keep the assistant's visual page context in step with route navigation.
    this.pageContextSync.start();
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.updateRouteVisibility(event.urlAfterRedirects);
      }
    });
  }

  private updateRouteVisibility(url: string): void {
    const path = url.split(/[?#]/, 1)[0];
    this.showTerritoryReference = path.startsWith('/problems/');
    this.showIntegratedChatbot = isIntegratedChatbotPath(path);
  }

  doLogin() {
    this.authService.login();
  }

  doLogout() {
    this.authService.logout();
  }
}
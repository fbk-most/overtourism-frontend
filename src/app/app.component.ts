import { Component, OnInit } from '@angular/core';
import { AuthenticationService } from './services/authentication.service';
import { NavigationEnd, Router } from '@angular/router';

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
    private router: Router

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
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.updateRouteVisibility(event.urlAfterRedirects);
      }
    });
  }

  private updateRouteVisibility(url: string): void {
    const path = url.split(/[?#]/, 1)[0];
    this.showTerritoryReference = path.startsWith('/problems/');
    const section = path.split('/')[1];
    this.showIntegratedChatbot = section !== 'agent' && section !== 'users';
  }

  doLogin() {
    this.authService.login();
  }

  doLogout() {
    this.authService.logout();
  }
}
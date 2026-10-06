import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from '../../services/authentication.service';

export interface HeaderLink {
  label: string;
  route: string;
}

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss'
})
export class AppHeaderComponent {
  darkMode = false;

  private readonly baseLinks: HeaderLink[] = [
    { label: 'Analisi', route: '/problems' },
    { label: 'Indici territoriali', route: '/indici' },
    { label: 'Assistente AI', route: '/agent' },
  ];

  private readonly usersLink: HeaderLink = { 
    label: 'Gestione Utenti', 
    route: '/users' 
  };

  constructor(
    public router: Router,
    public authService: AuthenticationService
  ) {}

  toggleTheme() {
    this.darkMode = !this.darkMode;
    document.body.classList.toggle('it-dark-mode', this.darkMode);
  }

  get links(): HeaderLink[] {
    return this.authService.canManageUsers
      ? [...this.baseLinks, this.usersLink]
      : this.baseLinks;
  }

  trackByRoute(_index: number, item: HeaderLink): string {
    return item.route;
  }

  doLogout() {
    this.authService.logout();
  }

  isActive(link: HeaderLink): boolean {
    if (link.route === '/problems') {
      return this.router.url.startsWith('/problems');
    }
    return this.router.url === link.route;
  }
}
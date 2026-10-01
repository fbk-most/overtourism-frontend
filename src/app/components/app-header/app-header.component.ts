import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from '../../services/authentication.service';

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss'
})
export class AppHeaderComponent {
  darkMode = false;

  constructor(
    public router: Router,
    public authService: AuthenticationService
  ) {}

  toggleTheme() {
    this.darkMode = !this.darkMode;
    document.body.classList.toggle('it-dark-mode', this.darkMode);
  }

  links = [
    { label: 'Analisi', route: '/problems' },
    { label: 'Indici territoriali', route: '/indici' },
    { label: 'Assistente AI', route: '/agent' },
  ];

  doLogout() {
    this.authService.logout();
  }

  isActive(link: any): boolean {
    if (link.route === '/problems') {
      return this.router.url.startsWith('/problems');
    }
    return this.router.url === link.route;
  }
}
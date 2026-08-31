import { Component, EventEmitter, Output } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from '../../services/authentication.service';
import { ScenarioService } from '../../services/scenario.service';

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss'
})
export class AppHeaderComponent {
  darkMode = false;
constructor(public router: Router,    public authService: AuthenticationService ,private scenarioService: ScenarioService
) {
}
ngOnInit() {
   if (this.authService.isLoggedIn) {
    this.scenarioService.getTenants().subscribe({
      next: (res) => {
        this.authService.setAvailableTenants(res);
         const current = this.authService.activeTenant; 
      },
      error: (err) => console.error("Errore recupero lista tenant: ", err)
    });
  }
}

  toggleTheme() {
    this.darkMode = !this.darkMode;
    document.body.classList.toggle('it-dark-mode', this.darkMode);
  }
  links = [
    { label: 'Analisi', route: '/problems' },
    { label: 'Indici territoriali', route: '/indici' },
    // { label: 'Indici di Capacità', route: '/capacity' },
    // { label: 'Flussi', route: '/flows' },
    // { label: 'Livello di Affollamento', route: '/overtourism' },
    // { label: 'Ridistribuzione dei turisti', route: '/redistribution' },
    // { label: 'Turismo Sommerso', route: '/hidden' },
    { label: 'Assistente AI', route: '/agent' },
    { label: 'Statistiche AI', route: '/agent-stats' } 

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
  get tenants() {
    return this.authService.availableTenants;
  }

  get currentTenant() {
    return this.authService.activeTenant;
  }

  onTenantChange(selectedTenant: string) {
    this.authService.setActiveTenant(selectedTenant);
  }
}

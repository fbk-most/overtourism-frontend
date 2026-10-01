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
    this.scenarioService.getTerritorys().subscribe({
      next: (res) => {
        this.authService.setAvailableTerritorys(res);
         const current = this.authService.activeTerritory; 
      },
      error: (err) => console.error("Errore recupero lista territory: ", err)
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
    { label: 'Assistente AI', route: '/agent' },
    // { label: 'Statistiche AI', route: '/agent-stats' } 

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
  get territorys() {
    return this.authService.availableTerritorys;
  }

  get currentTerritory() {
    return this.authService.activeTerritory;
  }

  onTerritoryChange(selectedTerritory: string) {
    this.authService.setActiveTerritory(selectedTerritory);
  }
}

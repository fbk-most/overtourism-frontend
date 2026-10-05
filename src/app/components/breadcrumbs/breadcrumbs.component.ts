import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Breadcrumb, BreadcrumbService } from '../../services/breadcrumb.service';
import { AuthenticationService } from '../../services/authentication.service';
import { ScenarioService } from '../../services/scenario.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-breadcrumbs',
  standalone: false,
  templateUrl: './breadcrumbs.component.html',
  styleUrl: './breadcrumbs.component.scss'
})
export class BreadcrumbsComponent implements OnInit {
  breadcrumbs$!: Observable<Breadcrumb[]>;

  constructor(
    private breadcrumbService: BreadcrumbService,
    public router: Router,
    public authService: AuthenticationService,
    private scenarioService: ScenarioService
  ) {}

  ngOnInit() {
    this.breadcrumbs$ = this.breadcrumbService.breadcrumbs;

    if (this.authService.isLoggedIn && this.territories.length === 0) {
      this.scenarioService.getTerritories().subscribe({
        next: (res) => this.authService.setAvailableTerritories(res),
        error: (err) => console.error("Errore recupero lista territory: ", err)
      });
    }
  }

  get isAnalisiTab(): boolean {
    return this.router.url.startsWith('/problems');
  }

  get territories(): string[] {
    return (this.authService.availableTerritories || []).filter(t => t.toLowerCase() !== 'default');
  }

  get currentTerritory(): string {
    const curr = this.authService.activeTerritory;
    return curr.toLowerCase() === 'default' ? '' : curr;
  }

  onTerritoryChange(selectedTerritory: string) {
    this.authService.setActiveTerritory(selectedTerritory);
  }
}
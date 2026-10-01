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

    if (this.authService.isLoggedIn && this.territorys.length === 0) {
      this.scenarioService.getTerritorys().subscribe({
        next: (res) => {
          const valid = (res || []).filter(t => t.toLowerCase() !== 'default');
          this.authService.setAvailableTerritorys(valid);
        },
        error: (err) => console.error("Errore recupero lista territory: ", err)
      });
    }
  }

  get isAnalisiTab(): boolean {
    return this.router.url.startsWith('/problems');
  }

  get territorys(): string[] {
    return (this.authService.availableTerritorys || []).filter(t => t.toLowerCase() !== 'default');
  }

  get currentTerritory(): string {
    const curr = this.authService.activeTerritory;
    return curr.toLowerCase() === 'default' ? '' : curr;
  }

  onTerritoryChange(selectedTerritory: string) {
    this.authService.setActiveTerritory(selectedTerritory);
  }
}
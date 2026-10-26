import { Component, ViewChild } from '@angular/core';
import { Problem } from '../../../models/problem.model';
import { ProblemService } from '../../../services/problem.service';
import { of, delay, Observable, Subscription } from 'rxjs';
import { NotificationService } from '../../../services/notifications.service';
import { ItModalComponent, SearchItem } from 'design-angular-kit';
import { Router } from '@angular/router';
import { ChatbotContextService } from '../../../services/chatbot/chatbotContext.service';
import { AuthenticationService } from '../../../services/authentication.service';
import { ScenarioService } from '../../../services/scenario.service';

@Component({
  selector: 'app-problems',
  standalone: false,
  templateUrl: './problems.component.html',
  styleUrl: './problems.component.scss'
})
export class ProblemsComponent {
  problems: Problem[] = [];
  loading = true;
  errorMessage = '';
  @ViewChild('problemModal') problemModal!: ItModalComponent;
  private territorySub?: Subscription;

  openCreateProblemModal() {
    this.problemModal.show();
  }
  
  onProblemSaved(problem: Problem) {
    this.problemModal.hide();
    this.loadProblems(); // ricarica la lista
  }
  onProblemCancel() {
    this.problemModal.hide();
  }
  constructor(
    private problemService: ProblemService,
    private notificationService: NotificationService,
    private router: Router,
    private chatbotCtx: ChatbotContextService,
    public authService: AuthenticationService,
    private scenarioService: ScenarioService

  ) {}

  ngOnInit(): void {
    this.chatbotCtx.setContext(null, null, []);

    if (this.authService.isLoggedIn && this.territories.length === 0) {
      this.scenarioService.getTerritories().subscribe({
        next: (res) => this.authService.setAvailableTerritories(res),
        error: (err) => console.error('Errore recupero lista territory: ', err)
      });
    }

    this.territorySub = this.authService.activeTerritory$.subscribe((territory) => {
      if (territory) {
        this.problems = [];
        this.loadProblems();
      }
    });
  }
  get territories(): string[] {
    return (this.authService.availableTerritories || []).filter(t => t.toLowerCase() !== 'default');
  }

  get currentTerritory(): string {
    const curr = this.authService.activeTerritory || '';
    return curr.toLowerCase() === 'default' ? '' : curr;
  }
  onTerritoryChange(selectedTerritory: string): void {
    this.authService.setActiveTerritory(selectedTerritory);
  }
  ngOnDestroy(): void {
    this.territorySub?.unsubscribe();
  }
  searchProblems$: (search?: string | null | undefined) => Observable<Array<SearchItem>> = (search) => {
    if (!search) {
    return of([]);
  }

  return of(this.problems.map(problem => ({
    id: problem.problem_id,
    value: problem.name, 
    label: problem.name 
  })));
  };

  onSearchSelected(item: any): void {
    this.router.navigate(['/problems', item.id, 'scenari']);
  }

  get baseProblemRoute(): string[] | null {
    const territory = this.authService.activeTerritory?.toLowerCase().trim();
    if (!territory) return null;
    return [
      '/problems',
      `${territory}_base_problem`,
      'proposals',
      `${territory}_base_proposal`,
      'scenari',
      `${territory}_base_scenario`
    ];
  }

  goToBaseScenario(): void {
    const route = this.baseProblemRoute;
    if (route) {
      this.router.navigate(route);
    }
  }
  loadProblems(): void {
    this.loading = true;
    this.errorMessage = ''; 
    this.problemService.getProblems().subscribe({
      next: (data) => {
        this.problems = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Errore nel caricamento problems:', err);
        this.loading = false;
      }
    });
  }
}

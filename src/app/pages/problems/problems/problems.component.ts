import { Component, ViewChild } from '@angular/core';
import { Problem } from '../../../models/problem.model';
import { ProblemService } from '../../../services/problem.service';
import { of, delay, Observable } from 'rxjs';
import { NotificationService } from '../../../services/notifications.service';
import { ItModalComponent, SearchItem } from 'design-angular-kit';
import { Router } from '@angular/router';

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
  constructor(private problemService: ProblemService,
    private notificationService: NotificationService,
    private router: Router

  ) {}

  ngOnInit(): void {
    this.loadProblems();
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

  loadProblems(): void {

    this.loading = true;
    this.errorMessage = ''; 
    this.problemService.getProblems().subscribe({
      next: (data) => {

        this.problems = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Errore nel caricamento problems', err);
        this.notificationService.showError(err.message || 'Errore sconosciuto.');
        this.loading = false;
      }
    });
  }
}

import { Component, ViewChild } from '@angular/core';
import { ScenarioService, Widget } from '../../../services/scenario.service';
import { ProblemScenario } from '../../../models/scenario.model';
import { ActivatedRoute, Router } from '@angular/router';
import { ItModalComponent } from 'design-angular-kit';
import { NotificationService } from '../../../services/notifications.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-scenari',
  standalone: false,
  templateUrl: './scenari.component.html',
  styleUrl: './scenari.component.scss'
})
export class ScenariComponent {
  @ViewChild('deleteModal') deleteModal!: ItModalComponent;
  scenarioToDelete: ProblemScenario | null = null;

  scenari: ProblemScenario[] = [];
  loading = true;
  problemId: any;
  proposalId: any;
  problemName: any;
  comparazioneAttiva = false;
  selectedScenari: any[] = [];
  widgets: Widget[] = []; 
  checkboxStates: { [id: string]: boolean } = {};

  constructor(
    private scenarioService: ScenarioService,
    private router: Router,
    private notificationService: NotificationService, 
    private translate: TranslateService,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.problemId = this.route.snapshot.paramMap.get('problemId')!;
    this.proposalId = this.route.snapshot.paramMap.get('proposalId')!;
    this.problemName = this.route.snapshot.queryParamMap.get('problemName');
    
    this.loadScenarios(this.problemId, this.proposalId);
    this.loadWidgets();
  }

  comparazioneDisponibile(): boolean {
    return this.scenari.length >= 2;
  }

  toggleComparazione() {
    this.comparazioneAttiva = !this.comparazioneAttiva;
    if (!this.comparazioneAttiva) {
      this.selectedScenari = [];
      this.checkboxStates = {};
    }
  }

  isScenarioSelected(scenario: any): boolean {
    return this.selectedScenari.some(s => s.id === scenario.id);
  }

  goToScenario(scenario: ProblemScenario): void {
    if (this.comparazioneAttiva) return;
    this.router.navigate([
      '/problems', 
      this.problemId, 
      'proposals', 
      this.proposalId, 
      'scenari', 
      scenario.id
    ]);
  }

  hasParams(scenario: any): boolean {
    return !!scenario.extras?.index_diffs && Object.keys(scenario.extras.index_diffs).length > 0;
  }
  
  onScenarioCheck(scenario: any, checked: boolean) {
    if (checked) {
      if (this.selectedScenari.length < 2 && !this.isScenarioSelected(scenario)) {
        this.selectedScenari.push(scenario);
      } else {
        this.checkboxStates[scenario.id] = false;
      }
    } else {
      this.selectedScenari = this.selectedScenari.filter(s => s.id !== scenario.id);
    }
  }

  getDiffDescription(scenario: any): string {
    if (!scenario.extras?.index_diffs) return '';
  
    const diffs = Object.entries(scenario.extras.index_diffs).map(([key, value]) => {
      const name = this.getIndexNameFromKey(key);
      return `<div width="300px"><strong>${name}</strong>: ${value}</div>`;
    });
  
    return diffs.join('');
  }
  
  getIndexNameFromKey(key: string): string {
    if (!this.widgets) {
      return key;
    }
  
    const widget = this.widgets.find((w: any) => w.name === key || w.index_id === key);
    if (widget) return widget.label || widget.name || key;
    
    return key;
  }
  
  confrontaScenari() {
    const [s1, s2] = this.selectedScenari;
    this.router.navigate([
      '/problems',
      this.problemId,
      'proposals',
      this.proposalId,
      'scenari',
      'confronta',
      s1.id,
      s2.id
    ]);
  }

  loadWidgets() {
    this.scenarioService.getConfiguration().subscribe({
      next: (config) => {
        const initialized = this.initializeWidgetBounds(config.indexes || []);
        this.widgets = initialized;
      },
      error: (err) => {
        console.error('Errore caricamento configuration', err);
      }
    });
  }

  private initializeWidgetBounds(widgets: Widget[]): Widget[] {
    const clone = JSON.parse(JSON.stringify(widgets));
    
    for (const widget of clone) {
      if (widget.scale && widget.index_category !== '%') {
        widget.vMin ??= widget.loc;
        widget.vMax ??= widget.loc + widget.scale;
      }
    }
    
    return clone;
  }

  loadScenarios(problemId: string, proposalId: string): void {
    this.loading = true;
    this.scenarioService.getScenarios(problemId, proposalId).subscribe({
      next: (data) => {
        this.scenari = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Errore nel caricamento scenari', err);
        this.loading = false;
      }
    });
  }

  openDeleteModal(scenario: ProblemScenario): void {
    this.scenarioToDelete = scenario;
    this.deleteModal.toggle();
  }

  onCancelDelete(): void {
    this.deleteModal.toggle();
    this.scenarioToDelete = null;
  }

  onConfirmDelete(): void {
    if (!this.scenarioToDelete) return;
  
    this.scenarioService.deleteScenario(this.scenarioToDelete.id, this.problemId, this.proposalId).subscribe({
      next: () => {
        this.scenari = this.scenari.filter(s => s.id !== this.scenarioToDelete!.id);
        this.deleteModal.toggle();
  
        this.notificationService.showSuccess(
          this.translate.instant('scenari.delete_success', { name: this.scenarioToDelete?.name })
        );
  
        this.scenarioToDelete = null;
      },
      error: (err) => {
        this.notificationService.showError(
          this.translate.instant('scenari.delete_error', { name: this.scenarioToDelete?.name }) ||
          err?.message
        );
        console.error('Errore durante l\'eliminazione dello scenario', err);
      }
    });
  }

  goToProblemDetail() {
    if (this.problemId) {
      this.router.navigate(['/problems', this.problemId]);
    }
  }
}
import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProposalService } from '../../../services/proposal.service';
import { ScenarioService, Widget } from '../../../services/scenario.service';
import { NotificationService } from '../../../services/notifications.service';
import { TranslateService } from '@ngx-translate/core';
import { Proposal } from '../../../models/proposal.model';
import { ProblemScenario } from '../../../models/scenario.model';
import { ItModalComponent } from 'design-angular-kit';
import { forkJoin } from 'rxjs';
import { ModalCleanupService } from '../../../services/modal-cleanup.service.ts.service';

@Component({
  selector: 'app-proposal-detail',
  templateUrl: './proposal-detail-page.component.html',
  styleUrls: ['./proposal-detail-page.component.scss'],
  standalone: false
})
export class ProposalDetailPageComponent implements OnInit, AfterViewInit {
  @ViewChild('deleteModal') deleteScenarioModal!: ItModalComponent;
  @ViewChild('proposalModal') proposalModal!: ItModalComponent;
  @ViewChild('editProposalModal') editProposalModal!: ItModalComponent;
  @ViewChild('deleteProposalModal') deleteProposalModal: any;

  problemId!: string;
  proposalId!: string;
  proposal: Proposal | null = null;
  scenari: ProblemScenario[] = [];
  proposalToDelete: Proposal | null = null;
  proposalToEdit: Proposal | null = null;

  comparazioneAttiva = false;
  selectedScenari: any[] = [];
  checkboxStates: { [id: string]: boolean } = {};
  widgets: any;
  loading = true;
  scenarioToDelete: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private proposalService: ProposalService,
    private scenarioService: ScenarioService,
    private notificationService: NotificationService,
    private translate: TranslateService,
    private modalCleanup: ModalCleanupService
  ) { }
  onProposalEdited() {
    this.editProposalModal.hide();
    this.loadProposal();
  }
  onProblemEditCancelled() {
    this.editProposalModal.hide();
  }
  getScenarioName(id: string): string {
    if (!this.scenari || this.scenari.length === 0) return id;
        const found = this.scenari.find(s => s.id === id || s.scenario_id === id);
    return found ? (found.name || id) : id;
  }
  ngOnInit(): void {
    this.problemId = this.route.snapshot.paramMap.get('problemId')!;
    this.proposalId = this.route.snapshot.paramMap.get('proposalId')!;


    this.loadProposal();
    this.loadWidgets();
  }
  ngAfterViewInit(): void {
    if (this.deleteScenarioModal) {
      this.modalCleanup.register(this.deleteScenarioModal);
    }
    if (this.deleteProposalModal) {
      this.modalCleanup.register(this.deleteProposalModal);
    }
    if (this.proposalModal) {
      this.modalCleanup.register(this.proposalModal);
    }
    if (this.editProposalModal) {
      this.modalCleanup.register(this.editProposalModal);
    }
  }

  ngOnDestroy(): void {
    this.modalCleanup.unregister(this.deleteScenarioModal);
    this.modalCleanup.unregister(this.deleteProposalModal);
    this.modalCleanup.unregister(this.proposalModal);
    this.modalCleanup.unregister(this.editProposalModal);
  }
  onProposalCreatedModal(): void {
    this.proposalModal.hide();
    this.loadProposal();
  }

  loadProposal(): void {
    this.loading = true;
    this.proposalService.getProposal(this.proposalId, this.problemId).subscribe({
      next: (data) => {
        this.proposal = data;    
        this.loadScenarios();
      },
      error: (err) => {
        console.error('Errore caricamento proposta', err);
        this.notificationService.showError(err.message || 'Errore caricamento proposta');
        this.loading = false;
      }
    });
  }
  loadRelatedScenarios(relatedScenarios: { scenario_id: string; scenario_name: string }[]): void {
    const observables = relatedScenarios.map(s =>
      this.scenarioService.getScenarioData(s.scenario_id, this.problemId)
    );

    forkJoin(observables).subscribe({
      next: (results) => {
        // 🔹 results è un array di scenari completi
        this.scenari = results;
        this.loading = false;
      },
      error: (err) => {
        console.error('Errore caricamento scenari', err);
        this.notificationService.showError('Errore caricamento scenari');
        this.loading = false;
      }
    });
  }
  loadScenarios(): void {
    this.scenarioService.getScenarios(this.problemId, this.proposalId).subscribe({
      next: (data:ProblemScenario[]) => {
        this.scenari = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Errore nel caricamento scenari', err);
        this.loading = false;
      }
    });
  }

  loadWidgets(): void {
    this.scenarioService.getWidgets().subscribe({
      next: (data) => {
        const initialized = this.initializeWidgetBounds(data);
        this.widgets = initialized;
      },
      error: (err) => {
        console.error('Errore caricamento widget', err);
      }
    });
  }

  private initializeWidgetBounds(widgets: Record<string, Widget[]>): Record<string, Widget[]> {
    const clone = JSON.parse(JSON.stringify(widgets));
    for (const key of Object.keys(clone)) {
      for (const widget of clone[key]) {
        if (widget.scale && widget.index_category !== '%') {
          widget.vMin ??= widget.loc;
          widget.vMax ??= widget.loc + widget.scale;
        }
      }
    }
    return clone;
  }

  toggleComparazione(): void {
    this.comparazioneAttiva = !this.comparazioneAttiva;
    if (!this.comparazioneAttiva) {
      this.selectedScenari = [];
      this.checkboxStates = {};
    }
  }

  onScenarioCheck(scenario: any, checked: boolean): void {
    if (checked) {
      if (this.selectedScenari.length < 2 && !this.isScenarioSelected(scenario)) {
        this.selectedScenari.push(scenario);
      } else {
        this.checkboxStates[scenario.scenario_id] = false;
      }
    } else {
      this.selectedScenari = this.selectedScenari.filter(s => s.id !== scenario.scenario_id);
    }
  }

  isScenarioSelected(scenario: any): boolean {
    return this.selectedScenari.some(s => s.scenario_id === scenario.scenario_id);
  }

  goToScenario(scenario: any): void {
    this.router.navigate([
      '/problems',
      this.problemId,
      'proposals',
      this.proposalId,
      'scenari',
      scenario.scenario_id
    ]);
  }

  confrontaScenari(): void {
    const [s1, s2] = this.selectedScenari;
    this.router.navigate([
      '/problems',
      this.problemId,
      'proposals',
      this.proposalId,
      'scenari',
      'confronta',
      s1.scenario_id,
      s2.scenario_id
    ]);
  }

  hasParams(scenario: any): boolean {
    return !!scenario.index_diffs && Object.keys(scenario.index_diffs).length > 0;
  }

  getDiffDescription(scenario: any): string {
    if (!scenario.index_diffs) return '';

    const diffs = Object.entries(scenario.index_diffs).map(([key, value]) => {
      const name = this.getIndexNameFromKey(key);
      return `<div width="300px"><strong>${name}</strong>: ${value}</div>`;
    });

    return diffs.join('');
  }

  getIndexNameFromKey(key: string): string {
    if (!this.widgets) {
      return key;
    }

    for (const group of Object.keys(this.widgets)) {
      const widget = this.widgets[group].find((w: { index_id: string; }) => w.index_id === key);
      if (widget) return widget.index_name;
    }
    return key;
  }

  openDeleteModalProposal(): void {
    this.proposalToDelete = this.proposal;
    this.deleteProposalModal.toggle();
  }

  onCancelDeleteProposal(): void {
    this.deleteProposalModal.toggle();
    this.proposalToDelete = null;
  }

  onConfirmDeleteProposal(): void {
    if (!this.proposalToDelete) return;

    this.proposalService.deleteProposal(this.proposalToDelete.proposal_id, this.problemId).subscribe({
      next: () => {
        this.notificationService.showSuccess(
          this.translate.instant('problems.delete_success', { name: this.proposalToDelete?.name })
        );
        this.deleteProposalModal.hide();

        this.router.navigate([`/problems/${this.problemId}`]);
      },
      error: (err) => {
        this.notificationService.showError(
          this.translate.instant('problems.delete_error', { name: this.proposalToDelete?.name }) ||
          err?.message
        );
        this.deleteProposalModal.hide();
      }
    });
  }
  onProposalCanel() {
    this.editProposalModal.hide();
  }


  openDeleteScenarioModal(scenario: any): void {
    this.scenarioToDelete = scenario;
    this.deleteScenarioModal.show();
  }

  onCancelDeleteScenario(): void {
    this.deleteScenarioModal.hide();
    this.scenarioToDelete = null;
  }

  onConfirmDeleteScenario(): void {
    if (!this.scenarioToDelete || !this.problemId) return;

    const scenarioId = this.scenarioToDelete.scenario_id;

    this.scenarioService.deleteScenario(scenarioId, this.problemId, this.proposalId).subscribe({
      next: () => {
        this.notificationService.showSuccess('Proposta eliminata con successo');
        this.scenari = this.scenari.filter(s => s.id !== scenarioId);
        this.deleteScenarioModal.hide();
        this.scenarioToDelete = null;
      },
      error: (err) => {
        this.notificationService.showError(err?.message || 'Errore durante l\'eliminazione della proposta');
        this.deleteScenarioModal.hide();
      }
    });
  }
}
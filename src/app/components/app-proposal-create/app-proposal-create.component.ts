import { Component, EventEmitter, Input, Output, SimpleChanges, ViewChild } from '@angular/core';
import { NotificationService } from '../../services/notifications.service';
import { ProposalService } from '../../services/proposal.service';
import { Proposal, ProposalScenario } from '../../models/proposal.model';
import { Router } from '@angular/router';
import { ScenarioService } from '../../services/scenario.service';
import { ProblemScenario } from '../../models/scenario.model';
import { TranslateService } from '@ngx-translate/core';
import { AutocompleteComponent } from '../autocomplete/autocomplete.component';

@Component({
  selector: 'app-proposal-create',
  standalone: false,
  templateUrl: './app-proposal-create.component.html',
  styleUrls: ['./app-proposal-create.component.scss']
})
export class ProposalCreateComponent {
  @Input() problemId!: string;
  @Output() proposalCreated = new EventEmitter<void>();
  @Input() proposalToEdit?: Proposal;
  @ViewChild('scenarioAuto') scenarioAuto!: AutocompleteComponent;
  @ViewChild('form') proposalForm: any;

  model = {
    title: '',
    description: '',
    resources: [] as string[],
    context: '',
    impact: '',
    status: 'draft',
    related_scenarios: [] as ProposalScenario[]
  };

  newResource = '';
  scenarioInput = '';
  availableScenarios: ProposalScenario[] = [];

  originalExtras: any = {};


  // 🔹 Fonte per l’autocomplete
  scenarioSource = (query: string, populateResults: (results: string[]) => void) => {
    const filtered = this.availableScenarios
      .filter(s => s.scenario_name.toLowerCase().includes(query.toLowerCase()))
      .map(s => s.scenario_name);
    populateResults(filtered);
  };
  get scenarioNames(): string[] {
    return this.availableScenarios.map(s => s.scenario_name);
  }
  addScenario(scenarioName: string) {
    const scenario = this.availableScenarios.find(s => s.scenario_name === scenarioName);
    if (scenario && !this.model.related_scenarios.some(s => s.scenario_id === scenario.scenario_id)) {
      this.model.related_scenarios.push(scenario);
    }

    // puliamo input e chiudiamo panel
    if (this.scenarioAuto) {
      this.scenarioAuto.clear(); // svuota e chiude
      this.scenarioAuto.inputEl.nativeElement.blur(); // togli focus
    }
  }

  removeScenario(scenario: ProposalScenario, event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
      // anche se l'evento bubbla, evita che il form venga sottomesso
      const form = (event.target as HTMLElement).closest('form');
      form?.addEventListener('submit', e => e.preventDefault(), { once: true });
    }
    this.model.related_scenarios = this.model.related_scenarios.filter(
      s => s.scenario_id !== scenario.scenario_id
    );
  }

  constructor(
    private proposalSvc: ProposalService,
    private notif: NotificationService,
    private scenarioSvc: ScenarioService,
    private translate: TranslateService


  ) { }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['problemId'] && this.problemId) {
      this.loadScenarios();
    }

    if (changes['proposalToEdit']) {
      this.originalExtras = this.proposalToEdit?.extras || {};

      if (this.proposalToEdit) {
        this.model = {
          title: this.proposalToEdit.name || '',
          description: this.proposalToEdit.description || '',
          resources: [...(this.originalExtras.resources || [])],
          context: this.originalExtras.context || '',
          impact: this.originalExtras.impact || '',
          status: this.proposalToEdit.status || 'draft',
          related_scenarios: []
        };
        this.syncRelatedScenarios();
      } else {
        this.originalExtras = {};
        this.model = {
          title: '',
          description: '',
          resources: [],
          context: '',
          impact: '',
          status: 'draft',
          related_scenarios: []
        };
        if (this.proposalForm) {
          this.proposalForm.resetForm();
        }
        if (this.scenarioAuto) {
          this.scenarioAuto.clear();
        }
      }
    }
  }


  loadScenarios() {
    this.scenarioSvc.getScenarios(this.problemId).subscribe({
      next: (scenarios: ProblemScenario[]) => {
        this.availableScenarios = scenarios.map(s => ({
          scenario_id: s.id,
          scenario_name: s.name
        } as ProposalScenario));

        this.syncRelatedScenarios();

        const baseScenario = this.availableScenarios.find(s => s.scenario_id.endsWith('_base_scenario'));


        if (
          baseScenario && !this.proposalToEdit &&
          !this.model.related_scenarios.some(s => s.scenario_id === baseScenario.scenario_id)
        ) {
          this.model.related_scenarios.push(baseScenario);
        }
      },
      error: (err) => {
        this.notif.showError(err?.message || 'Errore nel caricamento degli scenari');
      }
    });
  }

  addResource() {
    if (this.newResource.trim()) {
      this.model.resources.push(this.newResource.trim());
      this.newResource = '';
    }
  }

  removeResource(i: number) {
    this.model.resources.splice(i, 1);
  }
  onSubmitForm(event: Event) {
    if ((event.target as HTMLButtonElement).type === 'button') {
      event.preventDefault();
      return;
    }
    this.onSubmit();
  }
  resetForm() {
    this.model = {
      title: '',
      description: '',
      resources: [],
      context: '',
      impact: '',
      status: 'draft',
      related_scenarios: []
    };
    this.originalExtras = {};
    if (this.proposalForm) {
      this.proposalForm.resetForm();
    }
    if (this.scenarioAuto) {
      this.scenarioAuto.clear();
    }

    const baseScenario = this.availableScenarios.find(s => s.scenario_id.endsWith('_base_scenario'));
    if (baseScenario) {
      this.model.related_scenarios.push(baseScenario);
    }
  }
  isUrl(value: string): boolean {
    return value.startsWith('http://') || value.startsWith('https://');
  }
  syncRelatedScenarios() {
    if (this.proposalToEdit && this.proposalToEdit.related_scenario_ids && this.availableScenarios.length > 0) {
      this.model.related_scenarios = this.proposalToEdit.related_scenario_ids
        .map(id => this.availableScenarios.find(s => s.scenario_id === id))
        .filter(s => !!s) as ProposalScenario[];
    }
  }
  isSaving = false;

  async onSubmit() {
    if (this.isSaving) return; // evita doppi click
    this.isSaving = true;

    try {
      if (!this.problemId) {
        this.notif.showError(this.translate.instant('problems.proposals.invalid_problem'));
        return;
      }
      const payload: Proposal = {
        proposal_id: this.proposalToEdit ? this.proposalToEdit.proposal_id : this.generateId(),
        problem_id: this.problemId,
        name: this.model.title,
        version: this.proposalToEdit?.version || 0,
        description: this.model.description,
        status: this.model.status || 'draft',
        related_scenario_ids: this.model.related_scenarios.map(s => s.scenario_id),
        extras: {
          ...this.originalExtras,
          resources: this.model.resources || [],
          context: this.model.context || '',
          impact: this.model.impact || ''
        },
        created: this.proposalToEdit ? this.proposalToEdit.created : new Date().toISOString(),
        updated: new Date().toISOString()
      };

      let res: any;

      if (this.proposalToEdit) {
        res = await this.proposalSvc
          .updateProposal(this.proposalToEdit.proposal_id, this.problemId, payload)
          .toPromise();

        this.notif.showSuccess(
          this.translate.instant('problems.proposals.update_success', { name: payload.name })
        );
      } else {
        res = await this.proposalSvc.createProposal(this.problemId, payload).toPromise();

        this.notif.showSuccess(
          this.translate.instant('problems.proposals.create_success', { name: payload.name })
        );
      }

      this.proposalCreated.emit();
      if (!this.proposalToEdit) {
        this.resetForm();
      }
    } catch (err: any) {
      this.notif.showError(
        this.translate.instant('problems.proposals.create_error', { name: this.model.title }) ||
        err?.message
      );
    } finally {
      this.isSaving = false;
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 12);
  }
}

import { Component, Input, OnInit, OnChanges, SimpleChanges, EventEmitter, Output, OnDestroy } from '@angular/core';
import { Widget } from '../../../services/scenario.service';
import { ExplanationService } from '../../../services/explanation.service';
import { DataFact } from '../../../models/data-fact.model';
import { AgentService } from '../../../services/agent.service';
import { AuthenticationService } from '../../../services/authentication.service';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-reading',
  standalone: false,
  templateUrl: './reading.component.html',
  styleUrl: './reading.component.scss'  
})
export class ReadingComponent implements OnInit, OnChanges, OnDestroy {
  @Input() widgets!: Record<string, Widget[]>;
  @Input() indexDiffs!: Record<string, any>;
  @Input() originalIndexDiffs!: Record<string, any>;
  @Input() savedSummary?: string | null = null;
  @Input() loading: boolean = false;
  @Input() dataFacts: DataFact[] = [];
  @Input() scenarioIds: string[] = []; 
  @Input() originalScenarioIds: string[] = [];
  @Input() sessionId?: string;        
  @Input() evaluationId?: string;  
  @Input() sottosistemi: {value: string, label: string}[] = [];
  @Output() summaryChange = new EventEmitter<string | null>();

  selectedCategory = 'default';
  dataFactsParametersChanges: DataFact[] = [];

  aiSummary: string | null = null;
  aiSummaryLoading = false;
  aiSummaryError = false;

  private summarySub?: Subscription;

  constructor(
    private explanationService: ExplanationService,
    private agentService: AgentService,
    private authService: AuthenticationService
  ) {} 
  
  async ngOnInit(): Promise<void> {
    if (this.savedSummary && this.savedSummary.trim().length > 0 && !this.sessionId) {
      await this.displaySavedSummary(this.savedSummary);
    }

    if (this.dataFacts.length > 0) {
      this.dataFactsParametersChanges = this.createParameterChanges();
    }
  }

  ngOnDestroy(): void {
    this.summarySub?.unsubscribe();
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    const scenarioChanged = changes['scenarioIds'] && !changes['scenarioIds'].firstChange;
    const evalChanged = changes['evaluationId'] && !changes['evaluationId'].firstChange;
    const indexDiffsChanged = changes['indexDiffs'] && !changes['indexDiffs'].firstChange;
    const savedSummaryChanged = changes['savedSummary'];

    if (changes['widgets'] && this.widgets && this.dataFacts?.length > 0) {
      this.dataFactsParametersChanges = this.createParameterChanges();
    }

    // Se cambia il sommario salvato da fuori (es. caricamento scenario)
    if (savedSummaryChanged && this.savedSummary && this.savedSummary.trim().length > 0 && !this.sessionId) {
      await this.displaySavedSummary(this.savedSummary);
      return;
    }

    // Se i parametri cambiano o cambia scenario, azzera il sommario per far riapparire il pulsante
    if (scenarioChanged || evalChanged || indexDiffsChanged) {
      this.aiSummary = null;
      this.aiSummaryError = false;
      this.summaryChange.emit(null);
    }
  }

  private async displaySavedSummary(summary: string): Promise<void> {
    this.summaryChange.emit(summary);
    const html = await marked.parse(summary);
    this.aiSummary = DOMPurify.sanitize(html);
    this.aiSummaryLoading = false;
    this.aiSummaryError = false;
  }

  generateAiSummary(): void {
    if (this.loading || this.aiSummaryLoading) return;

    const ids = this.originalScenarioIds.length ? this.originalScenarioIds : this.scenarioIds;
    if (!ids.length) return;
    if (this.sessionId && !this.evaluationId) return;

    this.aiSummaryLoading = true;
    this.aiSummaryError = false;

    this.summarySub?.unsubscribe();
    this.summarySub = this.agentService.getSummary(ids, this.sessionId, this.evaluationId).subscribe({
      next: async (res) => {
        const raw = res?.message || res?.result || res?.summary || res?.text || '';
        this.summaryChange.emit(raw); 
        const html = await marked.parse(raw);
        this.aiSummary = DOMPurify.sanitize(html);
        this.aiSummaryLoading = false;
      },
      error: () => {
        this.aiSummaryError = true;
        this.aiSummaryLoading = false;
      }
    });
  }

  getLocallyChangedKeys(): string[] {
    if (!this.indexDiffs || !this.originalIndexDiffs) return [];
    return Object.keys(this.indexDiffs).filter(key => 
      String(this.indexDiffs[key]) !== String(this.originalIndexDiffs[key])
    );
  }

  getIndexNameFromKey(key: string): string {
    if (!this.widgets) return key;
    
    for (const group of Object.values(this.widgets)) {
      const widget = group.find(w => w.name === key);
      if (widget) {
        return widget.label || key;
      }
    }
    return key;
  }

  private createParameterChanges(): DataFact[] {
    return Object.entries(this.indexDiffs)
      .filter(([key]) => this.getLocallyChangedKeys().includes(key))
      .map(([key, value]) => ({
        category: key,
        parameter: this.getIndexNameFromKey(key),
        original_value: this.originalIndexDiffs[key],
        new_value: value,
        violations_percentage: 0,
        uncertainty: 0
      }));
  }

  getChangedKeys(): string[] {
    return Object.keys(this.indexDiffs).filter(
      key => String(this.indexDiffs[key]) !== String(this.originalIndexDiffs[key])
    );
  }

  getGlobalIndexExplanation(): string {
    return this.explanationService.explainGlobalIndex(this.dataFacts, this.selectedCategory);
  }

  getIndexesListExplanation(): string {
    const categorieAttive = this.sottosistemi
      .filter(s => s.value !== 'default')
      .map(s => s.value);
      
    return this.explanationService.explainIndexesList(this.dataFacts, categorieAttive);
  }

  getUncertaintyExplanation(): string {
    return this.explanationService.explainUncertainty();
  }

  getParametersChangesExplanation(): string {
    return this.explanationService.explainParametersChanges(this.dataFactsParametersChanges);
  }
}
import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { Widget } from '../../../services/scenario.service';
import { ExplanationService } from '../../../services/explanation.service';
import { DataFact } from '../../../models/data-fact.model';
import { AgentService } from '../../../services/agent.service';
import { AuthenticationService } from '../../../services/authentication.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { debounceTime, Subject, Subscription, switchMap } from 'rxjs';

@Component({
  selector: 'app-reading',
  standalone: false,
  templateUrl: './reading.component.html',
  styleUrl: './reading.component.scss'  
})
export class ReadingComponent implements OnInit, OnChanges {
  @Input() widgets!: Record<string, Widget[]>;
  @Input() indexDiffs!: Record<string, any>;
  @Input() originalIndexDiffs!: Record<string, any>;
  @Input() dataFacts: DataFact[] = [];
  @Input() scenarioIds: string[] = []; 
  @Input() originalScenarioIds: string[] =[];
  @Input() sessionId?: string;        
  @Input() evaluationId?: string;  
  @Input() sottosistemi: {value: string, label: string}[] = [];
  selectedCategory = 'default';
  dataFactsParametersChanges: DataFact[] = [];

  aiSummary: SafeHtml | null = null;
  aiSummaryLoading = false;
  aiSummaryError = false;

  private summaryTrigger$ = new Subject<{ ids: string[]; sessionId?: string; evalId?: string }>();
  private summarySub?: Subscription;

  
  constructor(
    private explanationService: ExplanationService,
    private agentService: AgentService,
    private authService: AuthenticationService,
    private sanitizer: DomSanitizer
  ) {} 
  
  ngOnInit(): void {
    this.summarySub = this.summaryTrigger$.pipe(
      debounceTime(5000),
      switchMap(({ ids, sessionId, evalId }) => {
        this.aiSummaryLoading = true;
        this.aiSummaryError = false;
        return this.agentService.getSummary(ids, sessionId, evalId);
      })
    ).subscribe({
      next: async (res) => {
        const raw = res?.message || res?.result || res?.summary || res?.text || '';
        const html = await marked.parse(raw);
        this.aiSummary = this.sanitizer.bypassSecurityTrustHtml(html);
        this.aiSummaryLoading = false;
      },
      error: () => {
        this.aiSummaryError = true;
        this.aiSummaryLoading = false;
      }
    });
    if (this.dataFacts.length > 0) {
      this.dataFactsParametersChanges = this.createParameterChanges();
    }
    if (this.scenarioIds.length > 0 && !this.sessionId) {
      this.loadAiSummary();
    }
  }
  ngOnDestroy(): void {
    this.summarySub?.unsubscribe();
  }
  ngOnChanges(changes: SimpleChanges): void {
    const scenarioChanged = changes['scenarioIds'] && !changes['scenarioIds'].firstChange;
    const evalChanged = changes['evaluationId'] && !changes['evaluationId'].firstChange;

    if (scenarioChanged || evalChanged) {
      if (this.sessionId && !this.evaluationId) {
        return; 
      }
      
      if (evalChanged && !this.evaluationId) {
        return;
      }

      this.loadAiSummary();
    }
  }

  loadAiSummary() {
    const ids = this.originalScenarioIds.length ? this.originalScenarioIds : this.scenarioIds;
    
    if (!ids.length) return;
    if (this.sessionId && !this.evaluationId) return;

    this.summaryTrigger$.next({
      ids,
      sessionId: this.sessionId,
      evalId: this.evaluationId
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
    // Estraiamo solo le chiavi saltando 'default' (restituisce ['parking', 'beach', ecc.])
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

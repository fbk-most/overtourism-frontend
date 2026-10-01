import { Component, Input, OnInit, OnChanges, SimpleChanges, EventEmitter, Output, OnDestroy } from '@angular/core';
import { Widget } from '../../../services/scenario.service';
import { ExplanationService } from '../../../services/explanation.service';
import { DataFact } from '../../../models/data-fact.model';
import { AgentService } from '../../../services/agent.service';
import { AuthenticationService } from '../../../services/authentication.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { debounceTime, EMPTY, Subject, Subscription, switchMap } from 'rxjs';

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

  aiSummary: SafeHtml | null = null;
  aiSummaryLoading = false;
  aiSummaryError = false;

  private debouncedTrigger$ = new Subject<{ ids: string[]; sessionId?: string; evalId?: string }>();
  private summarySub?: Subscription;
  private directSub?: Subscription;

  constructor(
    private explanationService: ExplanationService,
    private agentService: AgentService,
    private authService: AuthenticationService,
    private sanitizer: DomSanitizer
  ) {} 
  
  ngOnInit(): void {
    // 🟢 Debounce solo quando si modificano i parametri (slider)
    this.summarySub = this.debouncedTrigger$.pipe(
      debounceTime(2500),
      switchMap(({ ids, sessionId, evalId }) => {
        if (this.savedSummary && this.savedSummary.trim().length > 0 && !this.sessionId) {
          return EMPTY;
        }
        return this.executeFetch(ids, sessionId, evalId);
      })
    ).subscribe();

    if (this.dataFacts.length > 0) {
      this.dataFactsParametersChanges = this.createParameterChanges();
    }
  }

  ngOnDestroy(): void {
    this.summarySub?.unsubscribe();
    this.directSub?.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const scenarioChanged = changes['scenarioIds'] && !changes['scenarioIds'].firstChange;
    const evalChanged = changes['evaluationId'] && !changes['evaluationId'].firstChange;
    const savedSummaryChanged = changes['savedSummary'];
    const loadingChanged = changes['loading'];

    if (changes['widgets'] && this.widgets && this.dataFacts?.length > 0) {
      this.dataFactsParametersChanges = this.createParameterChanges();
    }

    if (this.loading) {
      return;
    }

    if (savedSummaryChanged || loadingChanged || scenarioChanged || evalChanged) {
      if (this.sessionId && !this.evaluationId) {
        return; 
      }
      
      if (evalChanged && !this.evaluationId) {
        return;
      }

      this.loadAiSummary(evalChanged);
    }
  }

  async loadAiSummary(isParamChange: boolean = false): Promise<void> {
    // 1. Se abbiamo il summary salvato e non siamo in sessione di modifica, caricalo subito
    if (this.savedSummary && this.savedSummary.trim().length > 0 && !this.sessionId) {
      this.summaryChange.emit(this.savedSummary);
      const html = await marked.parse(this.savedSummary);
      this.aiSummary = this.sanitizer.bypassSecurityTrustHtml(html);
      this.aiSummaryLoading = false;
      this.aiSummaryError = false;
      return;
    }

    if (this.loading) return;

    const ids = this.originalScenarioIds.length ? this.originalScenarioIds : this.scenarioIds;
    if (!ids.length) return;
    if (this.sessionId && !this.evaluationId) return;

    // 2. Se è una modifica di parametri (slider), usa il debounce
    if (isParamChange || this.sessionId) {
      this.debouncedTrigger$.next({
        ids,
        sessionId: this.sessionId,
        evalId: this.evaluationId
      });
    } else {
      // 3. 🟢 Altrimenti (primo avvio senza summary), chiamata IMMEDIATA senza debounce
      this.directSub?.unsubscribe();
      this.directSub = this.executeFetch(ids, this.sessionId, this.evaluationId).subscribe();
    }
  }

  private executeFetch(ids: string[], sessionId?: string, evalId?: string) {
    this.aiSummaryLoading = true;
    this.aiSummaryError = false;

    return this.agentService.getSummary(ids, sessionId, evalId).pipe(
      switchMap(async (res) => {
        const raw = res?.message || res?.result || res?.summary || res?.text || '';
        this.summaryChange.emit(raw); 
        const html = await marked.parse(raw);
        this.aiSummary = this.sanitizer.bypassSecurityTrustHtml(html);
        this.aiSummaryLoading = false;
        return res;
      })
    );
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
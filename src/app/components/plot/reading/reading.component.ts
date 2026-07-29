import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { Widget } from '../../../services/scenario.service';
import { ExplanationService } from '../../../services/explanation.service';
import { DataFact } from '../../../models/data-fact.model';
import { AgentService } from '../../../services/agent.service';
import { AuthenticationService } from '../../../services/authentication.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

@Component({
  selector: 'app-reading',
  standalone: false,
  templateUrl: './reading.component.html',
  styleUrl: './reading.component.scss' // <-- nota: se dà problemi cambia in urls: ['./reading.component.scss']
})
export class ReadingComponent implements OnInit, OnChanges {
  @Input() widgets!: Record<string, Widget[]>;
  @Input() indexDiffs!: Record<string, any>;
  @Input() originalIndexDiffs!: Record<string, any>;
  @Input() dataFacts: DataFact[] = [];
  @Input() scenarioIds: string[] = []; 
  categories = ['parcheggi', 'spiaggia', 'alberghi', 'ristoranti'];
  selectedCategory = 'all';
  dataFactsParametersChanges: DataFact[] = [];

  aiSummary: SafeHtml | null = null;
  aiSummaryLoading = false;
  aiSummaryError = false;
  
  constructor(
    private explanationService: ExplanationService,
    private agentService: AgentService,
    private authService: AuthenticationService,
    private sanitizer: DomSanitizer
  ) {} 
  
  ngOnInit(): void {
    if (this.dataFacts.length > 0) {
      this.dataFactsParametersChanges = this.createParameterChanges();
    }
    if (this.scenarioIds.length > 0) {
      this.loadAiSummary();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['scenarioIds'] && !changes['scenarioIds'].firstChange) {
      this.loadAiSummary();
    }
  }

  loadAiSummary() {
    if (!this.scenarioIds.length) return;
    this.aiSummaryLoading = true;
    this.aiSummaryError = false;
    this.aiSummary = null;

    this.agentService.getSummary(this.scenarioIds).subscribe({
      next: async (res) => {
        const raw = res?.message || res?.result || res?.summary || res?.text || '';
        // FIX: handle marked as async/promise if needed, or use parse()
        const html = await marked.parse(raw); 
        this.aiSummary = this.sanitizer.bypassSecurityTrustHtml(html);
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
      const widget = group.find(w => w.index_id === key);
      if (widget) {
        return widget.index_name || key;
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
    return this.explanationService.explainIndexesList(this.dataFacts, this.categories);
  }

  getUncertaintyExplanation(): string {
    return this.explanationService.explainUncertainty();
  }

  getParametersChangesExplanation(): string {
    return this.explanationService.explainParametersChanges(this.dataFactsParametersChanges);
  }
}

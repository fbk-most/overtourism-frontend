import { Component, ViewChild, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import { KPIs, PlotInput } from '../../../models/plot.model';
import { PlotService } from '../../../services/plot.service';
import { ScenarioService, Widget } from '../../../services/scenario.service';
import { PdfService } from '../../../services/pdf.service';
import { TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { ConfrontoScenariContext } from '../../../models/confronto-scenari-context.model';
import { ChatbotDialogComponent } from '../../../components/chatbot/chatbot-integrated/chatbot-dialog/chatbot-dialog.component';
import { AgentService } from '../../../services/agent.service';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { stripSystemKpis } from '../../../utils/kpi.utils';
import { PlotMapper } from '../../../models/plot.model';

@Component({
  selector: 'app-confronto-scenari',
  templateUrl: './confronto-scenari.component.html',
  styleUrls: ['./confronto-scenari.component.scss'],
  standalone: false
})
export class ConfrontoScenariComponent implements OnInit, OnDestroy {
  scenari: any[] = [];
  selectedScenario1Id!: string;
  selectedScenario2Id!: string;
  problemId!: string;
  proposalId!: string;
  baseScenarioId!: string;
  selectedControlOption!: string;
  scenario2Color = '#D9D9D9'; // grigio
  scenario1Color = '#0066CC'; // blu
  kpisLeft?: KPIs;
  kpisRight?: KPIs;
  monoDimensionale = false;
  showAllSubsystems = true;
  sottosistemi: any[] = [];
  colorMap: any[] = [];
  kpiMapper: Record<string, string> = {};
  sottosistemaSelezionato = 'default';
  widgetsLeft: Record<string, Widget[]> = {};
  widgetsRight: Record<string, Widget[]> = {};
  diffsLeftToRight: any[] = [];
  diffsRightToLeft: any[] = [];
  @ViewChild('chartLeft', { static: true }) chartLeft!: ElementRef<HTMLElement>;
  @ViewChild('chartRight', { static: true }) chartRight!: ElementRef<HTMLElement>;
  showControls: boolean = false;
  isDownloading = false;
  isLoading = false;
  histogramPayload: any = null; 
  baseWidgets: Record<string, Widget[]> = {};

  plotInputLeft?: PlotInput;
  plotInputRight?: PlotInput; 
  
  aiSummary: string | null = null;
  aiSummaryLoading = false;
  aiSummaryError = false;
  private aiSummarySub?: Subscription;
  plotMapper: PlotMapper = {};

  constructor(
    private scenarioService: ScenarioService,
    private plotService: PlotService,
    private route: ActivatedRoute,
    private router: Router,
    private pdfService: PdfService,
    private translate: TranslateService,
    private dialog: MatDialog,
    private agentService: AgentService
  ) { }

  async ngOnInit() {
    this.problemId = this.route.snapshot.paramMap.get('problemId')!;
    this.proposalId = this.route.snapshot.paramMap.get('proposalId') || '';
    
    const id1 = this.route.snapshot.paramMap.get('id1');
    const id2 = this.route.snapshot.paramMap.get('id2');

    this.selectedScenario1Id = id1 && id1 !== 'default' ? id1 : '';
    this.selectedScenario2Id = id2 && id2 !== 'default' ? id2 : '';

    const tempScenarioId = sessionStorage.getItem('overtourism_temp_scenario_id');
    this.baseScenarioId = (this.selectedScenario1Id === tempScenarioId)
      ? (this.route.snapshot.queryParamMap.get('baseScenarioId') || 'model_0')
      : this.selectedScenario1Id;

    try {
      const parsed = await firstValueFrom(this.scenarioService.getParsedConfiguration());
      this.sottosistemi = parsed.sottosistemi;
      this.colorMap = parsed.colorMap;
      this.kpiMapper = parsed.kpiMapper;
      this.plotMapper = parsed.plotMapper;
      this.baseWidgets = parsed.baseWidgets;  
    } catch (err) {
      console.error('Errore caricamento configurazione base', err);
    }

    try {
      const scenari = await firstValueFrom(
        this.scenarioService.getScenarios(this.problemId, this.proposalId || undefined)
      );
      this.scenari = [...scenari];

      if (this.selectedScenario1Id && !this.scenari.some(s => s.id === this.selectedScenario1Id)) {
        this.scenari.unshift({
          id: this.selectedScenario1Id,
          scenario_id: this.selectedScenario1Id,
          name: 'Scenario modificato (corrente)',
          problem_id: this.problemId
        });
      }

      if (this.selectedScenario2Id && !this.scenari.some(s => s.id === this.selectedScenario2Id)) {
        this.scenari.unshift({
          id: this.selectedScenario2Id,
          scenario_id: this.selectedScenario2Id,
          name: 'Scenario modificato (corrente)',
          problem_id: this.problemId
        });
      }
    } catch (err) {
      console.error('Errore nel recupero scenari:', err);
    }

    if (this.selectedScenario1Id) {
      this.loadScenario(1);
    }
    if (this.selectedScenario2Id) {
      this.loadScenario(2);
    }
  }

  goBackToScenario(): void {
    if (this.proposalId && this.baseScenarioId) {
      this.router.navigate([
        '/problems',
        this.problemId,
        'proposals',
        this.proposalId,
        'scenari',
        this.baseScenarioId
      ]);
    } else {
      window.history.back();
    }
  }

  ngOnDestroy(): void {
    this.aiSummarySub?.unsubscribe();
  }

  selectScenario(slot: 1 | 2, id: string): void {
    this.aiSummary = null;
    this.aiSummaryError = false;

    if (slot === 1) {
      this.selectedScenario1Id = id;
      this.loadScenario(1);
    } else {
      this.selectedScenario2Id = id;
      this.loadScenario(2);
    }
  }

  generateAiSummary(): void {
    const ids = [this.selectedScenario1Id, this.selectedScenario2Id].filter(Boolean);
    if (ids.length === 0 || this.aiSummaryLoading) return;

    this.aiSummaryLoading = true;
    this.aiSummaryError = false;

    this.aiSummarySub?.unsubscribe();
    this.aiSummarySub = this.agentService.getSummary(ids).subscribe({
      next: async (res) => {
        const raw = res?.message || res?.result || res?.summary || res?.text || '';
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

  private updateHistogramPayload() {
    if ((this.selectedScenario1Id && this.kpisLeft) || (this.selectedScenario2Id && this.kpisRight)) {
      const cleanLeft = stripSystemKpis(this.kpisLeft);
      const cleanRight = stripSystemKpis(this.kpisRight);

      this.histogramPayload = {
        dataLeft: cleanLeft,
        dataRight: cleanRight,
        labelLeft: this.selectedScenario1Id ? (this.getScenarioName(this.selectedScenario1Id) || '') : '',
        labelRight: this.selectedScenario2Id ? (this.getScenarioName(this.selectedScenario2Id) || '') : ''
      };
    } else {
      this.histogramPayload = null;
    }
  }

  getScenarioName(id: string | undefined): string | undefined {
    if (!id || id === 'default') return undefined;
    const found = this.scenari.find(s => s.id === id);
    if (found) return found.name;
    return 'Scenario modificato (corrente)';
  }

  getDiffKeys(kpisA: KPIs | undefined, kpisB: KPIs | undefined): string[] {
    if (!kpisA || !kpisB) return [];
    const keys = new Set([...Object.keys(kpisA), ...Object.keys(kpisB)]);
    return Array.from(keys).filter(key => String(kpisA[key]) !== String(kpisB[key]));
  }

  getDiffsFor(kpisA: KPIs | undefined, kpisB: KPIs | undefined): { key: string, value: any }[] {
    const diffKeys = this.getDiffKeys(kpisA, kpisB);
    return diffKeys.map(key => ({ key, value: kpisA ? kpisA[key] : undefined }));
  }

  onPlotControlChange(value: string) {
    this.selectedControlOption = value;
    this.renderBoth();
  }

  onShowAllSubsystemsChange(value: boolean) {
    this.showAllSubsystems = value;
    this.renderBoth();
  }

  onMonoDimensionaleChange(value: boolean) {
    this.monoDimensionale = value;
    this.renderBoth();
  }

  onSottosistemaSelezionatoChange(value: string) {
    this.sottosistemaSelezionato = value;
    this.renderBoth();
  }

  onFunzioneChange() {
    this.renderBoth();
  }

  toggleControls(): void {
    this.showControls = !this.showControls;
  }

  renderBoth() {
    if (this.selectedScenario1Id) this.loadScenario(1);
    if (this.selectedScenario2Id) this.loadScenario(2);
  }

  async loadScenario(slot: 1 | 2) {
    const id = slot === 1 ? this.selectedScenario1Id : this.selectedScenario2Id;
    if (!id || id === 'default') return;
    this.isLoading = true;

    try {
      let dataSet: any;
      let specificWidgets = JSON.parse(JSON.stringify(this.baseWidgets));
      const sessionId = sessionStorage.getItem('overtourism_session_id');
      const tempScenarioId = sessionStorage.getItem('overtourism_temp_scenario_id');

      const isTemporarySession = !!(tempScenarioId && id === tempScenarioId && sessionId);

      if (!isTemporarySession) {
        // --- SCENARIO SALVATO: API standard ---
        const scenarioRes = await firstValueFrom(
          this.scenarioService.getScenarioData(id, this.problemId)
        );
        const rawOverrides = scenarioRes?.param_overrides || scenarioRes?.index_values || {};
        const valuesDict = this.scenarioService.arrayToDict(rawOverrides);
        specificWidgets = this.scenarioService.applyIndexDiffsToWidgets(this.baseWidgets, valuesDict);

        const evaluations = await firstValueFrom(
          this.scenarioService.getEvaluations(this.problemId, id)
        );
        const completedEvals = (evaluations || [])
          .filter(e => e.scenario_id === id && e.state === 'COMPLETED')
          .sort((a, b) => new Date(b.finished || 0).getTime() - new Date(a.finished || 0).getTime());

        if (completedEvals.length > 0) {
          const rawResponse = await firstValueFrom(
            this.scenarioService.getEvaluationData(completedEvals[0].evaluation_id, this.problemId)
          );
          dataSet = rawResponse.extras?.data || rawResponse.data || rawResponse;
        }
      } else {
        // --- SCENARIO TEMPORANEO DI SESSIONE: API sessioni ---
        const rawChangedWidgets = sessionStorage.getItem('overtourism_changed_widgets');
        if (rawChangedWidgets) {
          try {
            const changedWidgets = JSON.parse(rawChangedWidgets);
            specificWidgets = this.scenarioService.applyIndexDiffsToWidgets(this.baseWidgets, changedWidgets);
          } catch (e) {
            console.error('Errore parsing changed widgets da sessione', e);
          }
        }

        // Crea ed esegue evaluation temporanea
        const evalRes = await firstValueFrom(
          this.scenarioService.createSessionEvaluation(sessionId!, this.problemId, id)
        );
        const sessionEvalId = evalRes.evaluation_id || evalRes.id;

        if (sessionEvalId) {
          const rawResponse = await firstValueFrom(
            this.scenarioService.getSessionEvaluationData(sessionId!, sessionEvalId, this.problemId, false)
          );
          dataSet = rawResponse.extras?.data || rawResponse.data || rawResponse;
        }
      }

      if (!dataSet) {
        throw new Error(`Nessun dato disponibile per lo scenario ${id}`);
      }

      const input = this.plotService.preparePlotInput(
        dataSet,
        this.colorMap,
        this.sottosistemi,
        this.plotMapper
      );
      const container = slot === 1 ? this.chartLeft.nativeElement : this.chartRight.nativeElement;

      if (slot === 1) {
        this.plotInputLeft = input;
        this.kpisLeft = input.kpis ? this.filterKpis(input.kpis) : undefined;
        this.widgetsLeft = specificWidgets;
      } else {
        this.plotInputRight = input;
        this.kpisRight = input.kpis ? this.filterKpis(input.kpis) : undefined;
        this.widgetsRight = specificWidgets;
      }

      this.renderChart(container, input);
      this.updateDiffs();
      this.updateHistogramPayload();
    } catch (err) {
      console.error(`Errore durante il caricamento dello scenario ${slot}:`, err);
    } finally {
      this.isLoading = false;
    }
  }

  updateDiffs() {
    this.diffsLeftToRight = this.getWidgetDiffs(this.widgetsLeft, this.widgetsRight);
    this.diffsRightToLeft = this.getWidgetDiffs(this.widgetsRight, this.widgetsLeft);
  }

  filterKpis(rawData: Record<string, any>): Record<string, { level: number, confidence: number }> {
    return Object.keys(rawData)
      .filter(key => key.includes('constraint_level_') || key === 'sustainability_level' || key === 'critical_constraint')
      .reduce((obj, key) => {
        const value = rawData[key];
        obj[key] = typeof value === 'number'
          ? { level: value, confidence: 0 }
          : { level: value.level ?? 0, confidence: value.confidence ?? 0 };
        return obj;
      }, {} as Record<string, { level: number, confidence: number }>);
  }

  formatDiffValue(val: any): string {
    if (val === null || val === undefined || val === '' || val === 'None') {
      return '-';
    }
    if (Array.isArray(val)) {
      return `${val[0]} - ${val[1]}`;
    }
    if (typeof val === 'string') {
      return val.replace(/\bNone\b/g, '-');
    }
    return String(val);
  }

  getWidgetDiffs(
    widgetsA: Record<string, Widget[]>,
    widgetsB: Record<string, Widget[]>
  ): { index_id: string, index_name: string, value: any, otherValue: any }[] {
    const diffs: { index_id: string, index_name: string, value: any, otherValue: any }[] = [];
    const allIds = new Set<string>();
    Object.values(widgetsA).forEach(group => group.forEach(w => allIds.add(w.name)));
    Object.values(widgetsB).forEach(group => group.forEach(w => allIds.add(w.name)));
  
    for (const id of allIds) {
      const widgetA = Object.values(widgetsA).flat().find(w => w.name === id);
      const widgetB = Object.values(widgetsB).flat().find(w => w.name === id);
  
      if (widgetA && widgetB) {
        const isRange = widgetA.kind === 'distribution' || (widgetA.scale && widgetA.unit !== '%') || widgetA.vMin !== undefined || widgetB.vMin !== undefined;

        if (isRange) {
          const aMin = widgetA.vMin ?? widgetA.default_range?.[0] ?? widgetA.loc ?? '';
          const aMax = widgetA.vMax ?? widgetA.default_range?.[1] ?? ((widgetA.loc ?? 0) + (widgetA.scale ?? 0));
          const bMin = widgetB.vMin ?? widgetB.default_range?.[0] ?? widgetB.loc ?? '';
          const bMax = widgetB.vMax ?? widgetB.default_range?.[1] ?? ((widgetB.loc ?? 0) + (widgetB.scale ?? 0));

          if (aMin !== bMin || aMax !== bMax) {
            diffs.push({
              index_id: id,
              index_name: widgetA.label || id,
              value: `${aMin} - ${aMax}`,
              otherValue: `${bMin} - ${bMax}`
            });
          }
        } else {
          const rawA = widgetA.v !== undefined ? widgetA.v : (widgetA.default ?? widgetA.default_category ?? widgetA.loc ?? null);
          const rawB = widgetB.v !== undefined ? widgetB.v : (widgetB.default ?? widgetB.default_category ?? widgetB.loc ?? null);

          const strA = (rawA === null || rawA === undefined || rawA === 'None') ? '' : String(rawA);
          const strB = (rawB === null || rawB === undefined || rawB === 'None') ? '' : String(rawB);

          if (strA !== strB) {
            diffs.push({
              index_id: id,
              index_name: widgetA.label || id,
              value: this.formatDiffValue(rawA),
              otherValue: this.formatDiffValue(rawB)
            });
          }
        }
      }
    }
    return diffs;
  }
  
  renderChart(container: HTMLElement, input: PlotInput) {
    if (!container || !input) return;

    const cloned = JSON.parse(JSON.stringify(input)) as PlotInput;

    if (this.monoDimensionale) {
      this.plotService.renderMonoDimensionale(this.sottosistemaSelezionato, container, cloned, this.colorMap);
      return;
    }

    this.plotService.renderBidimensionale(
      this.sottosistemaSelezionato,
      container,
      cloned,
      this.colorMap
    );
  }

  getCapacityLabel(subsystem: string): string {
    return subsystem === 'default' ? 'Soglia di sovraffollamento' : 'Capacità di carico';
  }

  formatNumber(value: number): string {
    return value.toFixed(2);
  }

  async downloadPdf(): Promise<void> {
    if (this.isDownloading) return;
    this.isDownloading = true;
    setTimeout(async () => {
      try {
        await this.pdfService.downloadPdfFromElement(
          'pdfContent',
          `${this.getScenarioName(this.selectedScenario1Id)} vs ${this.getScenarioName(this.selectedScenario2Id) || 'confronto'}.pdf`
        );
      } finally {
        this.isDownloading = false;
      }
    }, 0);
  }

  buildChatbotContext(): ConfrontoScenariContext {
    return {
      scenarios: {
        left: {
          id: this.selectedScenario1Id,
          name: this.getScenarioName(this.selectedScenario1Id) ?? 'Scenario 1',
          color: this.scenario1Color,
          kpis: this.kpisLeft ?? {},
          widgets: Object.values(this.widgetsLeft).flat() ?? [],
          charts: this.plotInputLeft
            ? this.plotService.extractChartSummaries(
                this.plotInputLeft,
                'left',
                {
                  monoDimensionale: this.monoDimensionale,
                  sottosistemaSelezionato: this.sottosistemaSelezionato
                }
              )
            : []
        },
        right: {
          id: this.selectedScenario2Id,
          name: this.getScenarioName(this.selectedScenario2Id) ?? 'Scenario 2',
          color: this.scenario2Color,
          kpis: this.kpisRight ?? {},
          widgets: Object.values(this.widgetsRight).flat() ?? [],
          charts: this.plotInputRight
            ? this.plotService.extractChartSummaries(
                this.plotInputRight,
                'right',
                {
                  monoDimensionale: this.monoDimensionale,
                  sottosistemaSelezionato: this.sottosistemaSelezionato
                }
              )
            : []
        }
      },
      comparisons: {
        widgetDiffs: this.getWidgetDiffs(this.widgetsLeft, this.widgetsRight).map(d => ({
          index_id: d.index_id,
          index_name: d.index_name,
          left: d.value,
          right: d.otherValue
        }))
      },
      uiState: {
        monoDimensionale: this.monoDimensionale,
        sottosistemaSelezionato: this.sottosistemaSelezionato,
        showAllSubsystems: this.showAllSubsystems
      }
    };
  }

  openChatbot() {
    if (!this.plotInputLeft || !this.plotInputRight) {
      alert('Please wait until both scenarios are fully loaded.');
      return;
    }

    this.dialog.open(ChatbotDialogComponent, {
      width: '400px',
      height: '600px',
      data: this.buildChatbotContext()
    });
  }
}
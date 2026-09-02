import { Component, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import Plotly from 'plotly.js-dist-min';
import { firstValueFrom } from 'rxjs';
import { KPIs, PlotInput, Curve } from '../../../models/plot.model';
import { PlotService } from '../../../services/plot.service';
import { ScenarioService, Widget } from '../../../services/scenario.service';

import { PdfService } from '../../../services/pdf.service';
import { TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { ConfrontoScenariContext } from '../../../models/confronto-scenari-context.model';
import { ChatbotDialogComponent } from '../../../components/chatbot/chatbot-integrated/chatbot-dialog/chatbot-dialog.component';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AgentService } from '../../../services/agent.service';
import { marked } from 'marked';

@Component({
  selector: 'app-confronto-scenari',
  templateUrl: './confronto-scenari.component.html',
  styleUrls: ['./confronto-scenari.component.scss'],
  standalone: false
})


export class ConfrontoScenariComponent {
  scenari: any[] = [];
  selectedScenario1Id!: string;
  selectedScenario2Id!: string;
  problemId!: string;
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
  showControls: boolean = false; // per 'settings'
  isDownloading = false;
  isLoading = false;
  histogramPayload: any = null; 
  baseWidgets: Record<string, Widget[]> = {};

  
  plotInputLeft?: PlotInput;
  plotInputRight?: PlotInput; 
  
  aiSummary: SafeHtml | null = null;
  aiSummaryLoading = false;
  aiSummaryError = false;
  constructor(
    private scenarioService: ScenarioService,
    private plotService: PlotService,
    private route: ActivatedRoute,
    private pdfService: PdfService,
    private translate: TranslateService,
    private dialog: MatDialog,
    private agentService: AgentService,
    private sanitizer: DomSanitizer
  ) { }

  async ngOnInit() {
    this.problemId = this.route.snapshot.paramMap.get('problemId')!;

    try {
      const config = await firstValueFrom(this.scenarioService.getConfiguration());
      
      const meta = (config as any).metadata || config;

      if (meta.mapper && !Array.isArray(meta.mapper)) {
        this.sottosistemi = Object.entries(meta.mapper).map(([key, label]) => ({
          value: key,
          label: label as string
        }));
      } else {
        this.sottosistemi = meta.mapper || meta.map || [];
      }

      this.colorMap = meta.color_map || [];
      this.kpiMapper = meta.kpi_mapper || {};
      const dataDict: Record<string, Widget[]> = {};
      (config.indexes || []).forEach(w => {
        const cat = w.category || 'Generale';
        if (!dataDict[cat]) dataDict[cat] = [];
        dataDict[cat].push(w);
      });

      this.baseWidgets = this.initializeWidgetBounds(dataDict);
    } catch (err) {
      console.error('Errore caricamento configurazione base', err);
    }


    this.scenarioService.getScenarios(this.problemId).subscribe(scenari => {
      this.scenari = scenari;
      
      if (scenari.length >= 2) {
        this.selectedScenario1Id = this.route.snapshot.paramMap.get('id1')!;
        const id2 = this.route.snapshot.paramMap.get('id2');
        
        this.selectedScenario2Id = id2 && id2 !== 'default' ? id2 : '';
        
        this.loadScenario(1);
        this.loadScenario(2);
      }
    });
  }
  private initializeWidgetBounds(widgets: Record<string, Widget[]>): Record<string, Widget[]> {
    const clone = JSON.parse(JSON.stringify(widgets));
    for (const key of Object.keys(clone)) {
      for (const widget of clone[key]) {
        if (widget.scale && widget.unit !== '%') {
          widget.vMin ??= widget.loc;
          widget.vMax ??= widget.loc + widget.scale;
        }
      }
    }
    return clone;
  }
  private updateHistogramPayload() {
    // Basta che almeno uno dei due scenari sia selezionato (e abbia dati)
    if ((this.selectedScenario1Id && this.kpisLeft) || (this.selectedScenario2Id && this.kpisRight)) {
      const cleanLeft = { ...this.kpisLeft };
      const cleanRight = { ...this.kpisRight };

      delete cleanLeft['critical_constraint'];
      delete cleanLeft['critical constraint'];
      delete cleanRight['critical_constraint'];
      delete cleanRight['critical constraint'];

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
  // private arrayToDict(values: any[]): Record<string, any> {
  //   const dict: Record<string, any> = {};
  //   (values || []).forEach(v => {
  //     if (v.index_id) dict[v.index_id] = v.value;
  //   });
  //   return dict;
  // }

  private applyIndexDiffsToWidgets(
    widgets: Record<string, Widget[]>,
    indexVals: Record<string, any>  
  ): Record<string, Widget[]> {
    const clone = JSON.parse(JSON.stringify(widgets));
    for (const key of Object.keys(clone)) {
      for (const widget of clone[key]) {
        const newVal = indexVals[widget.name];
        if (newVal !== undefined) {
          if (Array.isArray(newVal)) {
            widget.vMin = newVal[0];
            widget.vMax = newVal[1];
          } else {
            widget.v = newVal;
          }
        }
      }
    }
    return clone;
  }
  getScenarioName(id: string | undefined): string | undefined {
    return this.scenari.find(s => s.id === id)?.name;
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
  selectScenario(slot: 1 | 2, id: string): void {
    if (slot === 1) {
      this.selectedScenario1Id = id;
      this.loadScenario(1);
    } else {
      this.selectedScenario2Id = id;
      this.loadScenario(2);
    }
  }

  onPlotControlChange(value: string) {
    this.selectedControlOption = value;
    this.renderBoth()
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
    this.loadScenario(1);
    this.loadScenario(2);
  }

  async loadScenario(slot: 1 | 2) {
    const id = slot === 1 ? this.selectedScenario1Id : this.selectedScenario2Id;
    if (!id) return;
    this.isLoading = true;
    try {
      const scenarioRes = await firstValueFrom(this.scenarioService.getScenarioData(id, this.problemId));

      const rawOverrides = scenarioRes.param_overrides || scenarioRes.index_values || {};
      const valuesDict = this.arrayToDict(rawOverrides);
      const specificWidgets = this.applyIndexDiffsToWidgets(this.baseWidgets, valuesDict);


      const evaluations = await firstValueFrom(this.scenarioService.getEvaluations(this.problemId, id));
      const completedEvals = evaluations.filter(e => e.scenario_id === id && e.state === 'COMPLETED');
      completedEvals.sort((a, b) => new Date(b.finished || 0).getTime() - new Date(a.finished || 0).getTime());

      const currentEval = completedEvals[0];
      if (!currentEval) throw new Error(`Nessuna evaluation completata per lo scenario ${id}`);

      const rawResponse = await firstValueFrom(this.scenarioService.getEvaluationData(currentEval.evaluation_id, this.problemId));
      const dataSet = rawResponse.data || {};

      const input = this.plotService.preparePlotInput(dataSet, this.colorMap, this.sottosistemi);
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
      this.updateDiffs(); // Ricalcola le differenze dopo il fetch
      this.updateHistogramPayload();
    } catch (err) {
      console.error(`Errore durante il caricamento dello scenario ${slot}:`, err);
    }
    finally {
      this.isLoading = false; 
    }
    if (this.selectedScenario1Id && this.selectedScenario2Id && this.kpisLeft && this.kpisRight) {
      this.loadAiSummary();
    }
  }
  private loadAiSummary() {
    const ids = [this.selectedScenario1Id, this.selectedScenario2Id].filter(Boolean);
    if (ids.length === 0) return;

    this.aiSummaryLoading = true;
    this.aiSummaryError = false;
    this.aiSummary = null;

    this.agentService.getSummary(ids).subscribe({
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
  }
  private arrayToDict(values: any): Record<string, any> {
    if (!values) return {};
    
    if (Array.isArray(values)) {
      const dict: Record<string, any> = {};
      values.forEach(v => {
        if (!v) return;
        // Compatibilità con V1 (index_id, value) e V2 (index_name, index_value)
        const key = v.index_id || v.index_name;
        const val = v.index_value !== undefined ? v.index_value : v.value;
        if (key && val !== undefined) {
          dict[key] = val;
        }
      });
      return dict;
    }
    
    if (typeof values === 'object') {
      return values;
    }

    return {};
  }
  updateDiffs() {
    console.log('Widgets Left:', this.widgetsLeft);
    console.log('Widgets Right:', this.widgetsRight);
    
    this.diffsLeftToRight = this.getWidgetDiffs(this.widgetsLeft, this.widgetsRight);
    this.diffsRightToLeft = this.getWidgetDiffs(this.widgetsRight, this.widgetsLeft);
    
    console.log('Differenze L->R trovate:', this.diffsLeftToRight);
  }
  filterKpis(rawData: Record<string, any>): Record<string, { level: number, confidence: number }> {
    return Object.keys(rawData)
    .filter(key => key.includes('constraint_level_') || key === 'overtourism_level' || key === 'critical_constraint')
    .reduce((obj, key) => {
  
        const value = rawData[key];
        // se rawData[key] è un numero singolo, lo trasformiamo in oggetto level/confidence
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
        // Controllo se è un range [min, max]
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
          // Valore singolo (categorico o numerico)
          const rawA = widgetA.v !== undefined ? widgetA.v : (widgetA.default ?? widgetA.default_category ?? widgetA.loc ?? null);
          const rawB = widgetB.v !== undefined ? widgetB.v : (widgetB.default ?? widgetB.default_category ?? widgetB.loc ?? null);

          // Normalizza null, undefined e 'None' a stringa vuota per il confronto
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
  onScenarioSelect(slot: 1 | 2, selectedId: string) {
    if (slot === 1) {
      this.selectedScenario1Id = selectedId;
    } else {
      this.selectedScenario2Id = selectedId;
    }
    this.loadScenario(slot);
  }

  getCapacityLabel(subsystem: string): string {
    return subsystem === 'default' ? 'Soglia di sovraffollamento' : 'Capacità di carico';
  }


  formatNumber(value: number): string {
    return value.toFixed(2);
  }
  async downloadPdf(): Promise<void> {
    if (this.isDownloading) return; // evita doppi click
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
// const KPI_TRANSLATIONS: Record<string, string> = {
//   constraint_level_alberghi: 'constraint_level_alberghi',
//   constraint_level_parcheggi: 'kpi.constraint_level_parcheggi',
//   constraint_level_ristoranti: 'kpi.constraint_level_ristoranti',
//   constraint_level_spiaggia: 'kpi.constraint_level_spiaggia',
//   overtourism_level: 'kpi.overtourism_level'
// };
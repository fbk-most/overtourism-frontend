import { Component, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import Plotly from 'plotly.js-dist-min';
import { firstValueFrom } from 'rxjs';
import { KPIs, PlotInput, Curve } from '../../../models/plot.model';
import { PlotService } from '../../../services/plot.service';
import { ScenarioService, Widget } from '../../../services/scenario.service';
import {
  SUBSYSTEM_OPTIONS
} from '../../../components/plot/plot.config';
import { PdfService } from '../../../services/pdf.service';
import { TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { ConfrontoScenariContext } from '../../../models/confronto-scenari-context.model';
import { ChatbotDialogComponent } from '../../../components/chatbot/chatbot-window/chatbot-dialog/chatbot-dialog.component';

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
  sottosistemi = SUBSYSTEM_OPTIONS;
  sottosistemaSelezionato = 'default';
  widgetsLeft: Record<string, Widget[]> = {};
  widgetsRight: Record<string, Widget[]> = {};
  diffsLeftToRight: any[] = [];
  diffsRightToLeft: any[] = [];
  @ViewChild('chartLeft', { static: true }) chartLeft!: ElementRef<HTMLElement>;
  @ViewChild('chartRight', { static: true }) chartRight!: ElementRef<HTMLElement>;
  showControls: boolean = false; // per 'settings'
  isDownloading = false;
  baseWidgets: Record<string, Widget[]> = {};

  
  plotInputLeft?: PlotInput;
  plotInputRight?: PlotInput; 
  
  constructor(
    private scenarioService: ScenarioService,
    private plotService: PlotService,
    private route: ActivatedRoute,
    private pdfService: PdfService,
    private translate: TranslateService,
    private dialog: MatDialog
  ) { }

  async ngOnInit() {
    this.problemId = this.route.snapshot.paramMap.get('problemId')!;

    try {
      const data = await firstValueFrom(this.scenarioService.getWidgets());
      this.baseWidgets = this.initializeWidgetBounds(data);
    } catch (err) {
      console.error('Errore caricamento widget base', err);
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
        if (widget.scale && widget.index_category !== '%') {
          widget.vMin ??= widget.loc;
          widget.vMax ??= widget.loc + widget.scale;
        }
      }
    }
    return clone;
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
        const newVal = indexVals[widget.index_id];
        if (newVal !== undefined) {
          if (Array.isArray(newVal)) {
            widget.vMin = newVal[0];
            widget.vMax = newVal[1];
          } else {
            widget.v = typeof newVal === 'number' ? newVal : Number(newVal);
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

    try {
      const scenarioRes = await firstValueFrom(this.scenarioService.getScenarioData(id, this.problemId));
      const indexArray = scenarioRes.index_values || [];
      
      const valuesDict = this.arrayToDict(indexArray);
      const specificWidgets = this.applyIndexDiffsToWidgets(this.baseWidgets, valuesDict);

      const evaluations = await firstValueFrom(this.scenarioService.getEvaluations(this.problemId, id));
      const completedEvals = evaluations.filter(e => e.scenario_id === id && e.state === 'COMPLETED');
      completedEvals.sort((a, b) => new Date(b.finished || 0).getTime() - new Date(a.finished || 0).getTime());

      const currentEval = completedEvals[0];
      if (!currentEval) throw new Error(`Nessuna evaluation completata per lo scenario ${id}`);

      const rawResponse = await firstValueFrom(this.scenarioService.getEvaluationData(currentEval.evaluation_id, this.problemId));
      const dataSet = rawResponse.data || {};

      const input = this.plotService.preparePlotInput(dataSet);
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

    } catch (err) {
      console.error(`Errore durante il caricamento dello scenario ${slot}:`, err);
    }
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
      .filter(key => key.includes('_level_') || key === 'overtourism_level')
      .reduce((obj, key) => {
        const translatedKey = this.translate.instant('kpi.' + key);
  
        const value = rawData[key];
        // se rawData[key] è un numero singolo, lo trasformiamo in oggetto level/confidence
        obj[translatedKey] = typeof value === 'number'
          ? { level: value, confidence: 0 }
          : { level: value.level ?? 0, confidence: value.confidence ?? 0 };
  
        return obj;
      }, {} as Record<string, { level: number, confidence: number }>);
  }
  
  getWidgetDiffs(
    widgetsA: Record<string, Widget[]>,
    widgetsB: Record<string, Widget[]>
  ): { index_id: string, index_name: string, value: any, otherValue: any }[] {
    const diffs: { index_id: string, index_name: string, value: any, otherValue: any }[] = [];
    const allIds = new Set<string>();
    Object.values(widgetsA).forEach(group => group.forEach(w => allIds.add(w.index_id)));
    Object.values(widgetsB).forEach(group => group.forEach(w => allIds.add(w.index_id)));
  
    for (const id of allIds) {
      const widgetA = Object.values(widgetsA).flat().find(w => w.index_id === id);
      const widgetB = Object.values(widgetsB).flat().find(w => w.index_id === id);
  
      if (widgetA && widgetB) {
        // Se è un range (ha scale e non è percentuale)
        if (widgetA.scale && widgetA.index_category !== '%') {
          const aMin = widgetA.vMin ?? widgetA.loc;
          const aMax = widgetA.vMax ?? (widgetA.loc + widgetA.scale);
          const bMin = widgetB.vMin ?? widgetB.loc;
          const bMax = widgetB.vMax ?? (widgetB.loc + widgetB.scale);
          if (aMin !== bMin || aMax !== bMax) {
            diffs.push({
              index_id: id,
              index_name: widgetA.index_name,
              value: `${aMin} - ${aMax}`,
              otherValue: `${bMin} - ${bMax}`
            });
          }
        } else {
          // Valore singolo
          const valueA = widgetA.v ?? widgetA.loc ?? '';
          const valueB = widgetB.v ?? widgetB.loc ?? '';
          if (String(valueA) !== String(valueB)) {
            diffs.push({
              index_id: id,
              index_name: widgetA.index_name,
              value: valueA,
              otherValue: valueB
            });
          }
        }
      }
    }
    return diffs;
  }
  renderChart(container: HTMLElement, input: PlotInput) {
    const cloned = JSON.parse(JSON.stringify(input)) as PlotInput;

    // === MONODIMENSIONALE ===
    if (this.monoDimensionale) {
      this.plotService.renderMonoDimensionale(
        this.sottosistemaSelezionato,
        container,
        cloned
      );
      return;
    }
    this.plotService.renderBidimensionale(
      this.sottosistemaSelezionato,
      container,
      cloned
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
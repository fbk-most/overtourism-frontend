import { Component, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import Plotly from 'plotly.js-dist-min';
import { KPIs, PlotInput, Curve } from '../../../models/plot.model';
import { PlotService } from '../../../services/plot.service';
import { ScenarioService, Widget } from '../../../services/scenario.service';
import {
  SUBSYSTEM_OPTIONS
} from '../../../components/plot/plot.config';
import { PdfService } from '../../../services/pdf.service';
import { TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { ChatbotDialogComponent } from '../../../components/chatbot-dialog/chatbot-dialog.component';

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
  @ViewChild('chartLeft', { static: true }) chartLeft!: ElementRef<HTMLElement>;
  @ViewChild('chartRight', { static: true }) chartRight!: ElementRef<HTMLElement>;
  showControls: boolean = false; // per 'settings'
  isDownloading = false;

  
  
  constructor(
    private scenarioService: ScenarioService,
    private plotService: PlotService,
    private route: ActivatedRoute,
    private pdfService: PdfService,
    private translate: TranslateService,
    private dialog: MatDialog
  ) { }

  ngOnInit() {
    this.problemId = this.route.snapshot.paramMap.get('problemId')!;


    this.scenarioService.getScenariosByProblemId(this.problemId).subscribe(scenari => {
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

    const res = await this.scenarioService.getScenarioData(id, this.problemId).toPromise();
    const input = this.plotService.preparePlotInput(res.data);

    const container = slot === 1 ? this.chartLeft.nativeElement : this.chartRight.nativeElement;
    if (slot === 1) {
      this.kpisLeft = input.kpis ? this.filterKpis(input.kpis) : undefined;
      this.widgetsLeft = res.widgets || {};
    } else {
      this.kpisRight = input.kpis ? this.filterKpis(input.kpis) : undefined;
      this.widgetsRight = res.widgets || {};
    }
    this.renderChart(container, input);
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

  openChatbot(): void {
  this.dialog.open(ChatbotDialogComponent, {
    width: '450px',
    height: '600px',
    disableClose: false
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
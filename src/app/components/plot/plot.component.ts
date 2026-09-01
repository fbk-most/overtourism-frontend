// plot.component.ts
import { Component, ElementRef, AfterViewInit, ViewChild, Input } from '@angular/core';
import Plotly from 'plotly.js-dist-min';
import { PlotService } from '../../services/plot.service';
import { Curve, KPIs, PlotInput } from '../../models/plot.model';
import { ScenarioService, Widget } from '../../services/scenario.service';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../services/notifications.service';
import { Router } from '@angular/router';
import { ItModalComponent } from 'design-angular-kit';
import { TranslateService } from '@ngx-translate/core';
import { ProblemService } from '../../services/problem.service';

@Component({
  selector: 'app-plot',
  templateUrl: './plot.component.html',
  standalone: false,
  styleUrls: ['./plot.component.scss']
})
export class PlotComponent implements AfterViewInit {

  @ViewChild('chartLib', { static: false }) chartLib!: ElementRef<HTMLElement>;
  @ViewChild('saveModal') saveModal!: ItModalComponent;
  @ViewChild('unsavedModal') unsavedModal!: ItModalComponent;

  @Input() editing: boolean = false;
  @Input() scenarioId!: string;
  @Input() problemId!: string;
  @Input() proposalId!: string;
  @Input() version: number = 1;
  private navigationAfterSave = false;
  isSaving = false;
  inputData: PlotInput | null = null;
  sottosistemaSelezionato = 'default';
  loading = true;
  selectOptions: Array<{ value: string; text: string }> = [{ value: 'default', text: 'Default' }];
  // heatmapAttiva = true;
  // showAllSubsystems = true;
  monoDimensionale = false;
  kpisData: KPIs | undefined;
  noteUtente: string = '';
  originalWidgets: Record<string, Widget[]> = {};
  widgets: Record<string, Widget[]> = {};
  sottosistemi: any[] = [];
  colorMap: any[] = []; 
  kpiMapper: Record<string, string> = {};
  editableIndexes: string[] = [];
  objectKeys = Object.keys;

  // editSidebarVisible = false;
  selectedScenario: any = null;
  isEditing: boolean = false;
  showControls: boolean = false; // per 'settings'
  hasChanges: boolean = false;
  changedWidgets!: Record<string, any>;
  indexDiffs: Record<string, any> = {};
  titolo: string = '';
  descrizione: string = '';
  //widget diversi ma non locali, usati per il reset locale
  originalIndexDiffs: Record<string, any> = {};
  pendingNavigationResolve: ((result: boolean) => void) | null = null;
  sessionId!: string;
  sessionScenarioId: string | null = null;
  sessionEvaluationId: string | null = null;
  plotMapper: any;

  constructor(private plotService: PlotService,
    private scenarioService: ScenarioService,
    private problemService: ProblemService,
    private notificationService: NotificationService,
    private router: Router,
    private translate: TranslateService,
    private notif: NotificationService
  ) { }

  async ngAfterViewInit() {
    await this.initSessionAsync();
    await this.loadWidgetsAsync();
    await this.loadData();
  } catch(e: any) {
    console.error("Errore inizializzazione component plot", e);

  }
  ngOnInit() {

  }
  private async initSessionAsync(): Promise<void> {
    try {
      const response = await firstValueFrom(this.scenarioService.createSession(this.problemId));
      this.sessionId = response.session_id;
      sessionStorage.setItem('overtourism_session_id', this.sessionId);
      console.log('Session ID from backend:', this.sessionId);
    } catch (err: any) {
      console.error('Errore generazione sessione: ', err);
      this.notificationService.showError('Impossibile creare una sessione di calcolo con il server.');
      throw err;
    }
  }
  ngOnDestroy() {
    sessionStorage.removeItem('overtourism_session_id');
    console.log('Session ID removed');
  }
  private arrayToDict(values: any[]): Record<string, any> {
    const dict: Record<string, any> = {};
    (values || []).forEach(v => {
      if (v.index_name) dict[v.index_name] = v.index_value;
    });
    return dict;
  }
  formatValue(val: any): string {
    if (Array.isArray(val)) return `${val[0]} - ${val[1]}`;
    return String(val ?? '');
  }

  openSaveModal(): void {
    this.saveModal.toggle();
  }
  formInvalid = false;

  confirmSave(): void {
    if (!this.titolo?.trim() || !this.descrizione?.trim()) {
      this.formInvalid = true;
      return;
    }
    this.formInvalid = false;
    this.isSaving = true;
    this.saveAsNewScenario();
  }
  onSaveFromUnsaved(): void {
    this.unsavedModal.hide();
    this.saveModal.toggle();
  }

  saveAsNewScenario(): void {

    const targetScenarioId = this.sessionScenarioId || this.scenarioId;
    console.log('Saving as scenario ID:', targetScenarioId);
    this.scenarioService
      .saveSessionScenario(
        this.sessionId,
        targetScenarioId,
        this.version,
        this.problemId,
        this.proposalId,
        this.titolo,
        this.descrizione,
        this.changedWidgets
      )
      .subscribe({
        next: (res) => {
          this.isSaving = false;
          this.hasChanges = false;
          this.closeModal();
          this.navigationAfterSave = true;

          if (this.pendingNavigationResolve) {
            this.pendingNavigationResolve(true);
            this.pendingNavigationResolve = null;
          }

          this.notif.showSuccess(
            this.translate.instant('scenari.create_success', { name: this.titolo })
          );

          this.router.navigate(['/problems', this.problemId, 'proposals', this.proposalId]);
        },
        error: (err) => {
          this.isSaving = false;
          this.notif.showError(
            this.translate.instant('scenari.create_error', { name: this.titolo }) || err?.message
          );
          this.closeModal();
        }
      });
  }
  getIndexNameFromKey(key: string): string {
    for (const group of Object.keys(this.widgets)) {
      const widget = this.widgets[group].find(w => w.name === key);
      if (widget) return widget.label;
    }
    return key; // fallback se non trovato
  }
  closeModal() {
    this.saveModal.toggle();
  }

  async loadWidgetsAsync(): Promise<void> {
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
      this.plotMapper = meta.plot_mapper || {}; 

      const dataDict: Record<string, Widget[]> = {};
      (config.indexes || []).forEach(w => {
        const cat = w.category || 'Generale';
        if (!dataDict[cat]) dataDict[cat] = [];
        dataDict[cat].push(w);
      });

      const initialized = this.initializeWidgetBounds(dataDict);
      this.originalWidgets = JSON.parse(JSON.stringify(initialized));
      this.widgets = JSON.parse(JSON.stringify(this.originalWidgets));
    } catch (err) {
      console.error('Errore caricamento widget/configurazione', err);
      this.notificationService.showError('Errore nel caricamento della configurazione.');
    }
  }
  private initializeWidgetBounds(widgets: Record<string, Widget[]>): Record<string, Widget[]> {
    const clone = JSON.parse(JSON.stringify(widgets));
    for (const key of Object.keys(clone)) {
      for (const widget of clone[key]) {
        
        if (widget.kind === 'distribution') {
          widget.vMin = widget.vMin ?? (widget as any).default_range?.[0] ?? widget.min_value ?? 0;
          widget.vMax = widget.vMax ?? (widget as any).default_range?.[1] ?? widget.max_value ?? 100;
        } else if (widget.kind === 'scalar') {
          widget.v = widget.v ?? (widget as any).default ?? widget.min_value ?? 0;
        } else if (widget.kind === 'categorical') {
          widget.v = widget.v ?? (widget as any).default_category ?? (widget as any).support?.[0];
        } else if (widget.scale && widget.unit !== '%') {
          widget.vMin = widget.vMin ?? widget.loc;
          widget.vMax = widget.vMax ?? (widget.loc + widget.scale);
        }
      }
    }
    return clone;
  }
  onWidgetsChanged(updatedWidgets: Record<string, Widget[]>) {
    console.log('Widgets changed:', updatedWidgets);

    const changedValues: Record<string, any> = {};

    for (const key of Object.keys(updatedWidgets)) {
      const currentGroup = this.originalWidgets[key] || [];
      const updatedGroup = updatedWidgets[key];

      for (let i = 0; i < updatedGroup.length; i++) {
        const updated = updatedGroup[i];
        const original = currentGroup[i];

        if (!original) {
          // Nuovo widget
          changedValues[updated.name] = this.extractValue(updated);
          continue;
        }
        const hasChanged =
        updated.kind === 'categorical'
          ? updated.v !== original.v
          : updated.kind === 'distribution'
            ? updated.vMin !== original.vMin || updated.vMax !== original.vMax
            : updated.v !== original.v;

      if (hasChanged) {
        changedValues[updated.name] = this.extractValue(updated);
      }
    }
  }
  if (Object.keys(changedValues).length > 0) {
    this.hasChanges = true;
    
    this.changedWidgets = { ...this.changedWidgets, ...changedValues };
    
    this.updateData(changedValues);
  } else {
    this.hasChanges = false;
  }
}


  extractValue(widget: Widget): any {
    switch (widget.kind) {
      
      case 'categorical':
        // Manda la stringa selezionata (es. "monday", "bad", "very high")
        return widget.v 
          ?? (widget as any).default_category 
          ?? (widget as any).support?.[0];
      
      case 'distribution':
        // Manda un array [min, max] (es. [350, 450])
        return [
          widget.vMin ?? (widget as any).default_range?.[0] ?? widget.min_value ?? 0,
          widget.vMax ?? (widget as any).default_range?.[1] ?? widget.max_value ?? 100
        ];
      
      case 'scalar':
      default:
        // Manda il valore numerico fisso (es. 42)
        return widget.v ?? (widget as any).default ?? widget.min_value ?? 0;
    }
  }
  async updateData(values: Record<string, number | [number, number]>) {
    this.loading = true;
    // Resetta per dire ai figli (ReadingComponent) di aspettare
    this.sessionScenarioId = null;
    this.sessionEvaluationId = null;
    
    try {
      const sessionScenario = await firstValueFrom(
        this.scenarioService.createSessionScenario(this.sessionId, this.problemId, this.scenarioId, values)
      );
      const tempScenarioId = sessionScenario.scenario_id; // Salva in variabile temp

      const evaluationRes = await firstValueFrom(
        this.scenarioService.createSessionEvaluation(this.sessionId, this.problemId, tempScenarioId!)
      );
      const tempEvaluationId = evaluationRes.evaluation_id || evaluationRes.id; // Salva in variabile temp

      const rawResponse = await firstValueFrom(
        this.scenarioService.getSessionEvaluationData(
          this.sessionId,
          tempEvaluationId,
          this.problemId
        )
      );


      const scenarioData = rawResponse.extras?.data || rawResponse.data || rawResponse;
      this.inputData = this.plotService.preparePlotInput(scenarioData, this.colorMap, this.sottosistemi,this.plotMapper); 

      const actualNumericalValues = this.arrayToDict(sessionScenario.index_values || []);
      const backendDiffs = sessionScenario.extras?.index_diffs;

      this.indexDiffs = JSON.parse(JSON.stringify(
        backendDiffs               
        ?? values                  
        ?? actualNumericalValues   
        ?? {}
      ));

      this.kpisData = this.inputData.kpis;
      this.sessionScenarioId = tempScenarioId;
      this.sessionEvaluationId = tempEvaluationId;

    } catch (err: any) {
      console.error('Errore aggiornamento dati di sessione:', err);
      if (Object.keys(values).length > 0) {
        this.indexDiffs = { ...this.originalIndexDiffs, ...values };
      }

      this.notificationService.showError('Errore durante l\'aggiornamento iterativo del grafico.');
    } finally {
      this.loading = false;
    }
  }

  toggleEditing(): void {
    this.isEditing = !this.isEditing;
  }
  toggleControls(): void {
    this.showControls = !this.showControls;
  }
  goToCompare(): void {
    this.router.navigate([
      '/problems',
      this.problemId,
      'proposals',
      this.proposalId,
      'scenari',
      'confronta',
      this.scenarioId,
      'default'
    ]);
    console.log('Vai alla pagina di confronto');
  }
  private applyIndexDiffsToWidgets(
    widgets: Record<string, Widget[]>,
    indexVals: Record<string, any>
  ): Record<string, Widget[]> {
    const clone = JSON.parse(JSON.stringify(widgets));
    for (const key of Object.keys(clone)) {
      for (const widget of clone[key]) {
        const newVal = indexVals[widget.name];
        if (newVal === undefined) continue;

        switch (widget.kind) {
          case 'categorical':
            // Valore stringa
            widget.v = newVal;
            break;
          case 'distribution':
            // Array [min, max]
            if (Array.isArray(newVal)) {
              widget.vMin = newVal[0];
              widget.vMax = newVal[1];
            }
            break;
          case 'scalar':
          default:
            // Numero fisso
            widget.v = typeof newVal === 'number' ? newVal : Number(newVal);
            break;
        }
      }
    }
    return clone;
  }
  async loadData() {
    this.loading = true;
    if (!this.scenarioId || !this.problemId) {
      this.notificationService.showError('Scenario o problem mancanti.');
      this.loading = false;
      return;
    }
    try {
      const problemData = await firstValueFrom(this.problemService.getProblemById(this.problemId));
      // this.editableIndexes = problemData?.extras?.editable_indexes || [];
      const scenarioMetadata = await firstValueFrom(this.scenarioService.getScenarioData(this.scenarioId, this.problemId));

      const actualNumericalValues = this.arrayToDict(scenarioMetadata.index_values || []);

      let diffsValues = scenarioMetadata.extras?.index_diffs;

      if (!diffsValues && scenarioMetadata.index_values) {
        diffsValues = actualNumericalValues;
      }
      this.originalIndexDiffs = JSON.parse(JSON.stringify(diffsValues || {}));
      this.indexDiffs = JSON.parse(JSON.stringify(diffsValues || {}));
      this.widgets = this.applyIndexDiffsToWidgets(this.originalWidgets, actualNumericalValues);
      const evaluations = await firstValueFrom(this.scenarioService.getEvaluations(this.problemId, this.scenarioId));
      const completedEvals = evaluations.filter(e =>
        e.scenario_id === this.scenarioId && e.state === 'COMPLETED'
      );

      completedEvals.sort((a, b) => {
        const dateA = new Date(a.finished || 0).getTime();
        const dateB = new Date(b.finished || 0).getTime();
        return dateB - dateA; // Ordine decrescente
      });

      const currentEval = completedEvals[0];
      if (!currentEval) {
        throw new Error('Nessuna evaluation completata trovata per questo scenario.');
      }

      const validEvaluationId = currentEval.evaluation_id;
      const rawResponse = await firstValueFrom(this.scenarioService.getEvaluationData(validEvaluationId, this.problemId));

      const dataSet = rawResponse.data || {};

      // Prepariamo i dati per il plot (le curve)
      this.inputData = this.plotService.preparePlotInput(dataSet, this.colorMap, this.sottosistemi,this.plotMapper);
      this.kpisData = this.inputData.kpis;

      this.setupSelectOptions();
      // this.renderPlot();
    } catch (error: any) {
      console.error('Errore nel caricamento dati evaluation', error);
      this.notificationService.showError(
        `Errore: ${error.message || 'impossibile caricare i dati del grafico.'}`
      );
    } finally {
      this.loading = false;
    }
  }
  private setupSelectOptions() {
    if (this.inputData?.heatmapsByFunction) {
      this.selectOptions = [
        { value: 'default', text: 'Default' },
        ...Object.keys(this.inputData.heatmapsByFunction).map(key => ({
          value: key,
          text: key
        }))
      ];
    }
  }
  hasLocalDiffs(): boolean {
    // Confronta indexDiffs correnti con quelli originali caricati
    const current = this.indexDiffs || {};
    const original = this.originalIndexDiffs || {};
    const keys = new Set([...Object.keys(current), ...Object.keys(original)]);
    for (const key of keys) {
      if (String(current[key] ?? null) !== String(original[key] ?? null)) {
        return true;
      }
    }
    return false;
  }
  getLocallyChangedKeys(): string[] {
    const current = this.indexDiffs || {};
    const original = this.originalIndexDiffs || {};
    return Object.keys(current).filter(
      key => String(current[key] ?? null) !== String(original[key] ?? null)
    );
  }
  onFunzioneChange() {
    //   this.renderPlot();
  }
  resetIndexDiffs(): void {
    // Ripristina widgets e indexDiffs allo stato originale
    this.widgets = JSON.parse(JSON.stringify(this.originalWidgets));
    this.indexDiffs = JSON.parse(JSON.stringify(this.originalIndexDiffs));
    this.hasChanges = false;
    this.changedWidgets = {};
    this.loadData();
    this.notificationService.showError('Modifiche ripristinate.');
  }
  // renderPlot() {
  //   if (!this.chartLib || !this.inputData) return;
  //   if (this.monoDimensionale) {
  //     this.plotService.renderMonoDimensionale(this.sottosistemaSelezionato, this.chartLib.nativeElement, this.inputData);
  //     return;
  //   }
  //   const input = JSON.parse(JSON.stringify(this.inputData)) as PlotInput;
  //   this.plotService.renderBidimensionale(
  //     this.sottosistemaSelezionato,
  //     this.chartLib.nativeElement, this.inputData
  //   );


  // }

  canDeactivate(): Promise<boolean> | boolean {
    if (this.navigationAfterSave) {
      this.navigationAfterSave = false; // resetta per le prossime volte
      return true;
    }
    if (this.hasLocalDiffs()) {
      this.unsavedModal.show();
      return new Promise(resolve => {
        this.pendingNavigationResolve = resolve;
      });
    }
    return true;
  }

  // Da chiamare quando l’utente conferma di voler abbandonare senza salvare
  onConfirmLeaveWithoutSaving() {
    if (this.pendingNavigationResolve) {
      this.pendingNavigationResolve(true);
      this.pendingNavigationResolve = null;
      this.unsavedModal.hide();
    }
  }

  // Da chiamare se l’utente vuole restare
  onCancelLeave() {
    if (this.pendingNavigationResolve) {
      this.pendingNavigationResolve(false);
      this.pendingNavigationResolve = null;
      this.unsavedModal.hide();
    }
  }

}

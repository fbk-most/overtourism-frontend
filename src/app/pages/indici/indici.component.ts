import {
  Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy
} from '@angular/core';
import Plotly from 'plotly.js-dist-min';
// @ts-ignore
import * as itLocale from 'plotly.js-locales/it';
(Plotly as any).register(itLocale);

import { IndicatorMeta, Comune, ShowOption, TemporalGranularity, GeoDataEnvelope, VariationSeries } from '../../models/indici.model';
import { IndiciService } from '../../services/indici.service';


const PALETTE = [
  '#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261',
  '#264653', '#6a4c93', '#1982c4', '#8ac926', '#ff595e', '#6a994e',
];

@Component({
  selector: 'app-indici',
  templateUrl: './indici.component.html',
  styleUrls: ['./indici.component.scss'],
  standalone: false
})
export class IndiciComponent implements OnInit, AfterViewInit, OnDestroy {

  // ── Dati catalogo ──────────────────────────────────────────────────────────
  allIndicators: IndicatorMeta[] = [];
  visibleIndicators: IndicatorMeta[] = [];
  allComuni: Comune[] = [];
  allAreas: Comune[] = [];
  codeToName = new Map<string, string>();

  // ── Filtri ─────────────────────────────────────────────────────────────────
  showOption: ShowOption = 'map';
  enableVariation: boolean = false;        // Tasso di variazione
  enableImpactPercentage: boolean = false; // Percentuale impatto (mutuamente esclusivo)
  impactSeasonality: string = 'weekend';       // Valore periodo impatto
  selectedIndicator = '';
  startDate = '';
  endDate = '';
  seasonality = 'all';
  granularity: TemporalGranularity = 'annuale';
  startDateComparison = '';
  endDateComparison = '';
  spatialGranularity: 'comune' | 'macro_area' = 'comune';


  // ── Comuni selector ────────────────────────────────────────────────────────
  comuniQuery = '';
  comuniDropdownOpen = false;
  selectedComuni: string[] = [];
  selectedAreas: string[] = [];

  get currentSelection(): string[] {
    return this.spatialGranularity === 'comune' ? this.selectedComuni : this.selectedAreas;
  }
  get filteredComuni(): Comune[] {
    const q = this.comuniQuery.toLowerCase();
    return this.allComuni.filter(c =>
      !q || c.name.toLowerCase().includes(q) || c.code === '-1'
    ).slice(0, 50);
  }
  isComuneSelected(code: string) { return this.selectedComuni.includes(code); }

  // ── Stato UI ───────────────────────────────────────────────────────────────
  loading = false;
  error = '';
  isDirty = false;
  // ── Dati mappa ─────────────────────────────────────────────────────────────
  geoEnvelope: GeoDataEnvelope | null = null;
  get unitDescription(): string {
    return this.currentMeta?.index_value_unit_description || '';
  }
  get colorScaleMode(): 'linear' | 'log' {
    return ['indice-densita-turistica', 'turismo-sommerso'].includes(this.selectedIndicator)
      ? 'log' : 'linear';
  }

  // ── Dati chart ─────────────────────────────────────────────────────────────
  @ViewChild('chartEl') chartEl?: ElementRef;
  private chartLabels: string[] = [];
  public chartSeries: VariationSeries[] = [];
  chartType: 'scatter' | 'bar' = 'scatter';
  // ── Visibilità sezioni ─────────────────────────────────────────────────────
  get showMap() { return this.showOption === 'map'; }
  get showChart() { return this.showOption === 'chart'; }
  get showGranularity() { return this.showOption === 'chart'; }
  get showComuni() { return this.showOption === 'chart'; }
  get currentMeta() { return this.allIndicators.find(i => i.value === this.selectedIndicator); }
  get minDateBound() { return this.currentMeta?.years_range ? `${this.currentMeta.years_range.min_year}-01-01` : null; }
  get maxDateBound() { return this.currentMeta?.years_range ? `${this.currentMeta.years_range.max_year}-12-31` : null; }

  constructor(private svc: IndiciService) { }

  ngOnInit(): void {
    this.svc.getIndicatorList().subscribe({
      next: res => {
        this.allIndicators = res.indicators;
        this.updateVisibleIndicators();
        if (this.visibleIndicators.length) {
          const defaultInd = this.visibleIndicators.find(i => i.value !== 'tasso-variazione') || this.visibleIndicators[0];
          this.selectedIndicator = defaultInd.value;
          this.applyYearsRange();
        }
      },
      error: () => this.error = 'Impossibile caricare gli indicatori.'
    });

    this.svc.getSpatialAreas().subscribe(res => {
      this.allComuni = res.comuni || [];
      this.allAreas = res.areas || [];

      this.allComuni.forEach(c => this.codeToName.set(c.code, c.name));
      this.allAreas.forEach(a => this.codeToName.set(a.code, a.name));

      // Pre-seleziona il '-1' (aggregato) se esiste per Comuni
      const defaultComune = this.allComuni.find(c => c.code === '-1');
      if (defaultComune) this.selectedComuni = [defaultComune.code];

      // Pre-seleziona il '-1' globale se esiste per Aree
      const defaultArea = this.allAreas.find(c => c.code === '-1');
      if (defaultArea) this.selectedAreas = [defaultArea.code];
    });
  }

  ngAfterViewInit(): void { }

  ngOnDestroy(): void { }

  // ── Gestione filtri ────────────────────────────────────────────────────────


  selectIndicator(value: string): void {
    this.selectedIndicator = value;
    this.markDirty();
    this.onIndicatorChange();
  }

  onTabSelected(event: any): void {
    const tabLabel = event?.label?.toLowerCase() || '';
    if (tabLabel.includes('mappa') && this.showOption !== 'map') {
      this.showOption = 'map';
      this.onShowOptionChange();
    } else if (tabLabel.includes('grafic') && this.showOption !== 'chart') {
      this.showOption = 'chart';
      // this.enableVariation = false;
      this.onShowOptionChange();
    }
  }
  private applyYearsRange(): void {
    const meta = this.currentMeta;
    if (!meta?.years_range) return;
    const { min_year, max_year } = meta.years_range;
    this.startDate = `${max_year}-01-01`;
    this.endDate = `${max_year}-12-31`;
    this.startDateComparison = `${max_year}-01-01`;
    this.endDateComparison = `${max_year}-12-31`;
  }

  onShowOptionChange(): void {
    this.updateVisibleIndicators();
    this.geoEnvelope = null;
    this.markDirty();
  }

  onVariationToggle(): void {
    if (this.enableVariation) {
      this.enableImpactPercentage = false; //  Mutua esclusività
    }
    this.updateVisibleIndicators();
    this.geoEnvelope = null;
    this.markDirty();
  }
  onImpactPercentageToggle(): void {
    if (this.enableImpactPercentage) {
      this.enableVariation = false; //  Mutua esclusività
    }
    this.updateVisibleIndicators();
    this.geoEnvelope = null;
    this.markDirty();
  }
  onIndicatorChange(): void {
    this.applyYearsRange();

  }

  markDirty(): void {
    this.isDirty = true;
  }

  private updateVisibleIndicators(): void {
    const isVariation = this.enableVariation || this.showOption === 'chart';
    this.visibleIndicators = isVariation
      ? this.allIndicators.filter(i => i.availableForVariation !== false)
      : this.allIndicators;

    if (!this.visibleIndicators.find(i => i.value === this.selectedIndicator)) {
      const defaultInd = this.visibleIndicators.find(i => i.value !== 'tasso-variazione') || this.visibleIndicators[0];
      this.selectedIndicator = defaultInd?.value ?? '';
    }
  }


  // ── Comuni picker ──────────────────────────────────────────────────────────

  // Lista nomi disponibili per l'autocomplete (esclude già selezionati)
  get availableComuniNames(): string[] {
    return this.allComuni.filter(c => !this.selectedComuni.includes(c.code)).map(c => c.name);
  }
  // Lista nomi disponibili per l'autocomplete AREE  
  get availableAreaNames(): string[] {
    return this.allAreas.filter(a => !this.selectedAreas.includes(a.code)).map(a => a.name);
  }
  // Chiamato dall'app-autocomplete che restituisce il nome
  onComuneSelectedByName(name: string): void {
    const comune = this.allComuni.find(c => c.name === name);
    if (comune && !this.selectedComuni.includes(comune.code)) {
      if (this.selectedComuni.length >= 10) return;
      this.selectedComuni.push(comune.code);
      if (this.chartEl) this.updateChartVisibility();
    }
  }

  onAreaSelectedByName(name: string): void {
    const area = this.allAreas.find(a => a.name === name);
    if (area && !this.selectedAreas.includes(area.code)) {
      if (this.selectedAreas.length >= 10) return;
      this.selectedAreas.push(area.code);
      if (this.chartEl) this.updateChartVisibility();
    }
  }
  toggleComune(code: string): void {
    const idx = this.selectedComuni.indexOf(code);
    if (idx >= 0) {
      this.selectedComuni.splice(idx, 1);
    } else {
      if (this.selectedComuni.length >= 10) return;
      this.selectedComuni.push(code);
    }
    this.comuniQuery = '';
    this.comuniDropdownOpen = false;
    if (this.chartEl) this.updateChartVisibility();
  }

  removeComune(code: string): void { this.toggleComune(code); }
  removeArea(code: string): void {
    const idx = this.selectedAreas.indexOf(code);
    if (idx >= 0) this.selectedAreas.splice(idx, 1);
    if (this.chartEl) this.updateChartVisibility();
  }
  onComuniInput(): void { this.comuniDropdownOpen = true; }

  // ── Esegui query ───────────────────────────────────────────────────────────

  getData(): void {
    this.error = '';
    this.loading = true;
    this.geoEnvelope = null;

    if (!this.checkDateBounds()) {
      this.loading = false;
      return;
    }

    if (this.showOption === 'chart') {
      if (!this.startDate || !this.endDate) { this.loading = false; return; }

      this.svc.getVariationData(
        this.selectedIndicator, this.startDate, this.endDate,
        this.granularity, this.spatialGranularity
      ).subscribe({
        next: res => {
          this.chartLabels = res.labels;
          this.chartSeries = res.series;
          this.loading = false;
          this.isDirty = false;
          setTimeout(() => this.renderChart(), 50);
        },
        error: () => { this.error = 'Errore nel caricamento dati.'; this.loading = false; }
      });

    } else if (this.showOption === 'map') {

      const effectiveSeasonality = (this.seasonality && this.seasonality !== 'all') ? this.seasonality : undefined;

      if (this.enableVariation) {
        // 1. Caso Tasso di variazione (index = 'tasso-variazione')
        if (!this.startDate || !this.endDate || !this.startDateComparison || !this.endDateComparison) {
          this.loading = false; return;
        }
        this.svc.getIndexData(
          'tasso-variazione',
          this.startDate,
          this.endDate,
          effectiveSeasonality,
          this.spatialGranularity,
          this.selectedIndicator,
          this.startDateComparison,
          this.endDateComparison
        ).subscribe({
          next: res => { this.geoEnvelope = res.geo_data; this.loading = false; this.isDirty = false; },
          error: () => { this.error = 'Errore nel caricamento dati.'; this.loading = false; }
        });

      } else if (this.enableImpactPercentage) {
        // 2. Caso Percentuale impatto (index = 'incidenza-periodo')
        if (!this.startDate || !this.endDate) {
          this.loading = false; return;
        }
        this.svc.getIndexData(
          'incidenza-periodo',
          this.startDate,
          this.endDate,
          this.impactSeasonality, // 
          this.spatialGranularity,
          this.selectedIndicator // 
        ).subscribe({
          next: res => { this.geoEnvelope = res.geo_data; this.loading = false; this.isDirty = false; },
          error: () => { this.error = 'Errore nel caricamento dati.'; this.loading = false; }
        });

      } else {
        // 3. Caso Mappa normale indicatore
        this.svc.getIndexData(
          this.selectedIndicator,
          this.startDate || undefined,
          this.endDate || undefined,
          effectiveSeasonality,
          this.spatialGranularity
        ).subscribe({
          next: res => { this.geoEnvelope = res.geo_data; this.loading = false; this.isDirty = false; },
          error: () => { this.error = 'Errore nel caricamento dati.'; this.loading = false; }
        });
      }
    }
  }
  // ── Metodo di validazione Date ─────────────────────────────────────────────

  private checkDateBounds(): boolean {
    const minBound = this.minDateBound;
    const maxBound = this.maxDateBound;

    this.error = '';

    // 1. Controllo cronologico: Data fine >= Data Inizio per il periodo base
    if (this.startDate && this.endDate && this.startDate > this.endDate) {
      this.error = "La data di 'Fine periodo' non può essere precedente a 'Inizio periodo'.";
      return false;
    }

    // 2. Controlli temporali sul periodo di confronto (se variazione abilitata e tab mappa)
    if (this.showOption === 'map' && this.enableVariation) {
      if (this.startDateComparison && this.endDateComparison) {
        if (this.startDateComparison > this.endDateComparison) {
          this.error = "La data di 'Fine confronto' non può essere precedente a 'Inizio confronto'.";
          return false;
        }
        
        // Controllo richiesto: Il periodo di base e il periodo di confronto non possono essere uguali
        if (this.startDate === this.startDateComparison && this.endDate === this.endDateComparison) {
          this.error = "Il periodo di confronto non può coincidere esattamente con il periodo di base.";
          return false;
        }
      }
    }

    // Se non ci sono limiti configurati, salta i controlli ai bounds
    if (!minBound || !maxBound) return true;

    const isOutOfBounds = (d: string) => d && (d < minBound || d > maxBound);
    const msg = `Le date inserite devono essere comprese tra il ${this.currentMeta?.years_range.min_year} e il ${this.currentMeta?.years_range.max_year}.`;

    // 3. Controlla date fuori dai limiti minimi/massimi
    if (this.startDate || this.endDate) {
      if (isOutOfBounds(this.startDate) || isOutOfBounds(this.endDate)) {
        this.error = msg;
        return false;
      }
    }

    if (this.showOption === 'map' && this.enableVariation) {
      if (isOutOfBounds(this.startDateComparison) || isOutOfBounds(this.endDateComparison)) {
        this.error = msg;
        return false;
      }
    }

    return true; // Tutto ok
  }
  // ── Chart Plotly ───────────────────────────────────────────────────────────

  public renderChart(): void {
    if (!this.chartEl) return;

    const traces: Partial<Plotly.PlotData>[] = [];

    // Date grezze → Date objects per mensile/giornaliero, stringhe per annuale
    const xLabels = (this.granularity === 'mensile')
      ? this.chartLabels.map(l => new Date(l + '-01'))
      : this.granularity === 'giornaliero'
        ? this.chartLabels.map(l => new Date(l))
        : this.chartLabels;

    this.chartSeries.forEach((s, i) => {
      const isSelected = this.currentSelection.length === 0 || this.currentSelection.includes(s.label);

      let colorIndex = i;
      if (this.currentSelection.length > 0 && isSelected) {
        colorIndex = this.currentSelection.indexOf(s.label);
      }

      const color = PALETTE[colorIndex % PALETTE.length];
      const std = s.std ?? s.data.map(() => 0);
      const name = this.codeToName.get(s.label) || s.label;

      // Banda di confidenza (solo linee, solo se selezionato)
      if (this.chartType === 'scatter' && isSelected) {
        traces.push({
          x: [...xLabels, ...[...xLabels].reverse()],
          y: [
            ...s.data.map((v, j) => v + std[j]),
            ...[...s.data.map((v, j) => v - std[j])].reverse()
          ],
          fill: 'toself',
          fillcolor: color + '30',
          line: { color: 'transparent' },
          name: name + ' (conf.)',
          showlegend: false,
          hoverinfo: 'skip'
        } as any);
      }
      const hasStd = s.std && s.std.some(val => val > 0);
      const hoverTemplate = hasStd
        ? `%{y:.2f} ± %{customdata:.2f}<extra></extra>`
        : `%{y:.2f}<extra></extra>`;
      // Serie principale
      let traceConfig: any = {
        x: xLabels,
        y: s.data,
        type: this.chartType,
        name,
        customdata: std, // Array passato per leggere il customdata nel template
        hovertemplate: hoverTemplate,
        visible: isSelected ? true : false,
        showlegend: isSelected,
      };

      if (this.chartType === 'scatter') {
        traceConfig.mode = 'lines+markers';
        traceConfig.line = { color, width: 2 };
        traceConfig.marker = { color };
      } else { // chartType === 'bar'
        traceConfig.marker = { color };
        if (hasStd) {
          traceConfig.error_y = {
            type: 'data',
            array: std,
            visible: true,
            color: '#333333',
            thickness: 1.5,
            width: 3
          };
        }
      }

      traces.push(traceConfig);
    });


    const xAxisConfig: Partial<Plotly.LayoutAxis> =
      this.granularity === 'annuale'
        ? { type: 'linear', tickformat: 'd', dtick: 1 }
        : this.granularity === 'mensile'
          ? { type: 'date', tickformat: '%b %Y', dtick: 'M1' }
          : { type: 'date', tickformat: '%d %b %Y' };
    const yAxisConfig: Partial<Plotly.LayoutAxis> = this.unitDescription
      ? { title: { text: this.unitDescription, font: { size: 12, color: '#666' } } }
      : {};
    Plotly.react(this.chartEl.nativeElement, traces, {
      title: { text: `${this.currentMeta?.label ?? ''}`, font: { size: 14 } },
      height: 420,
      margin: { t: 50, l: 50, r: 20, b: 50 },
      legend: { orientation: 'h', y: -0.2 },
      hovermode: 'x unified',
      barmode: 'group',
      xaxis: xAxisConfig,
      yaxis: yAxisConfig,
    }, {
      responsive: true,
      displayModeBar: false,
      locale: 'it',
    });
  }


  private updateChartVisibility(): void {
    if (!this.chartEl || !this.chartSeries.length) return;
    // Richiama renderChart per aggiornare la visibilità
    this.renderChart();
  }
}
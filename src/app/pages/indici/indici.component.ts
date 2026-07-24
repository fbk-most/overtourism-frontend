import {
  Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy
} from '@angular/core';
import Plotly from 'plotly.js-dist-min';
import { IndicatorMeta, Comune, ShowOption, TemporalGranularity, GeoDataEnvelope, VariationSeries } from '../../models/indici.model';
import { IndiciService } from '../../services/indici.service';


const PALETTE = [
  '#e63946','#457b9d','#2a9d8f','#e9c46a','#f4a261',
  '#264653','#6a4c93','#1982c4','#8ac926','#ff595e','#6a994e',
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
  codeToName = new Map<string, string>();

  // ── Filtri ─────────────────────────────────────────────────────────────────
  showOption: ShowOption = 'map';
  selectedIndicator = '';
  startDate = '';
  endDate = '';
  seasonality = 'high';
  granularity: TemporalGranularity = 'annuale';
  startDateComparison = '';
  endDateComparison = '';
  spatialGranularity: 'comune' | 'macro_area' = 'comune';

  // ── Comuni selector ────────────────────────────────────────────────────────
  comuniQuery = '';
  comuniDropdownOpen = false;
  selectedComuni: string[] = [];
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

  // ── Dati mappa ─────────────────────────────────────────────────────────────
  geoEnvelope: GeoDataEnvelope | null = null;
  get colorScaleMode(): 'linear' | 'log' {
    return ['indice-densita-turistica', 'turismo-sommerso'].includes(this.selectedIndicator)
      ? 'log' : 'linear';
  }

  // ── Dati chart ─────────────────────────────────────────────────────────────
  @ViewChild('chartEl') chartEl?: ElementRef;
  private chartLabels: string[] = [];
  public chartSeries: VariationSeries[] = [];

  // ── Visibilità sezioni ─────────────────────────────────────────────────────
  get showMap()              { return this.showOption === 'map' || this.showOption === 'variation-map'; }
  get showChart()            { return this.showOption === 'variation-chart'; }
  get showSeasonality()      { return this.showOption === 'map' && this.currentMeta?.extraFields?.includes('seasonality'); }
  get showGranularity()      { return this.showOption === 'variation-chart'; }
  get showComuni()           { return this.showOption === 'variation-chart'; }
  get showComparisonDates()  { return this.showOption === 'variation-map'; }
  get currentMeta()          { return this.allIndicators.find(i => i.value === this.selectedIndicator); }
  get minDateBound()         { return this.currentMeta?.years_range ? `${this.currentMeta.years_range.min_year}-01-01` : null; }
  get maxDateBound()         { return this.currentMeta?.years_range ? `${this.currentMeta.years_range.max_year}-12-31` : null; }

  constructor(private svc: IndiciService) {}

  ngOnInit(): void {
    this.svc.getIndicatorList().subscribe({
      next: res => {
        this.allIndicators = res.indicators;
        this.updateVisibleIndicators();
        if (this.visibleIndicators.length) {
          this.selectedIndicator = this.visibleIndicators[0].value;
          this.applyYearsRange();
        }
      },
      error: () => this.error = 'Impossibile caricare gli indicatori.'
    });

    this.svc.getComuni().subscribe(res => {
      this.allComuni = res.comuni;
      this.allComuni.forEach(c => this.codeToName.set(c.code, c.name));
    });
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {}

  // ── Gestione filtri ────────────────────────────────────────────────────────

  onShowOptionChange(): void {
    this.updateVisibleIndicators();
    this.geoEnvelope = null;
  }

  onIndicatorChange(): void {
    this.applyYearsRange();
  }

  private updateVisibleIndicators(): void {
    const isVariation = this.showOption !== 'map';
    this.visibleIndicators = isVariation
      ? this.allIndicators.filter(i => i.availableForVariation !== false)
      : this.allIndicators;

    if (!this.visibleIndicators.find(i => i.value === this.selectedIndicator)) {
      this.selectedIndicator = this.visibleIndicators[0]?.value ?? '';
    }
  }

  private applyYearsRange(): void {
    const meta = this.currentMeta;
    if (!meta?.years_range) return;
    const { min_year, max_year } = meta.years_range;
    this.startDate = `${max_year}-01-01`;
    this.endDate   = `${max_year}-12-31`;
    this.startDateComparison = `${max_year}-01-01`;
    this.endDateComparison   = `${max_year}-12-31`;
  }

  // ── Comuni picker ──────────────────────────────────────────────────────────

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

  onComuniInput(): void { this.comuniDropdownOpen = true; }

  // ── Esegui query ───────────────────────────────────────────────────────────

  getData(): void {
    this.error = '';
    this.loading = true;
    this.geoEnvelope = null;

    if (this.showOption === 'map') {
      this.svc.getIndexData(
        this.selectedIndicator,
        this.startDate || undefined,
        this.endDate   || undefined,
        this.showSeasonality ? this.seasonality : undefined,
        this.spatialGranularity
      ).subscribe({
        next: res => { this.geoEnvelope = res.geo_data; this.loading = false; },
        error: e  => { this.error = 'Errore nel caricamento dati.'; this.loading = false; }
      });

    } else if (this.showOption === 'variation-chart') {
      if (!this.startDate || !this.endDate) { this.loading = false; return; }
      this.svc.getVariationData(
        this.selectedIndicator, this.startDate, this.endDate,
        this.granularity, this.spatialGranularity
      ).subscribe({
        next: res => {
          this.chartLabels = res.labels;
          this.chartSeries = res.series;
          this.loading = false;
          setTimeout(() => this.renderChart(), 50);
        },
        error: () => { this.error = 'Errore nel caricamento dati.'; this.loading = false; }
      });

    } else if (this.showOption === 'variation-map') {
      if (!this.startDate || !this.endDate || !this.startDateComparison || !this.endDateComparison) {
        this.loading = false; return;
      }
      this.svc.getVariationOverTime(
        this.selectedIndicator,
        this.startDate, this.endDate,
        this.startDateComparison, this.endDateComparison,
        this.spatialGranularity
      ).subscribe({
        next: res => { this.geoEnvelope = res.geo_data; this.loading = false; },
        error: () => { this.error = 'Errore nel caricamento dati.'; this.loading = false; }
      });
    }
  }

  // ── Chart Plotly ───────────────────────────────────────────────────────────

  private renderChart(): void {
    if (!this.chartEl) return;

    const traces: Partial<Plotly.PlotData>[] = [];

    this.chartSeries.forEach((s, i) => {
      const color = PALETTE[i % PALETTE.length];
      const std   = s.std ?? s.data.map(() => 0);
      const name  = this.codeToName.get(s.label) || s.label;
      const vis   = this.selectedComuni.length === 0 || this.selectedComuni.includes(s.label);

      // Banda di confidenza
      traces.push({
        x: [...this.chartLabels, ...[...this.chartLabels].reverse()],
        y: [
          ...s.data.map((v, j) => v + std[j]),
          ...[...s.data.map((v, j) => v - std[j])].reverse()
        ],
        fill: 'toself',
        fillcolor: color + '30',
        line: { color: 'transparent' },
        name: name + ' (conf.)',
        showlegend: false,
        visible: vis ? true : 'legendonly',
        hoverinfo: 'skip'
      } as any);

      // Serie principale
      traces.push({
        x: this.chartLabels,
        y: s.data,
        mode: 'lines+markers',
        name,
        line: { color, width: 2 },
        marker: { size: 4 },
        visible: vis ? true : 'legendonly',
      } as any);
    });

    Plotly.react(this.chartEl.nativeElement, traces, {
      title: {
        text: `Tasso di variazione — ${this.currentMeta?.label ?? ''}`,
        font: { size: 14 }
      },
      height: 420,
      margin: { t: 50, l: 50, r: 20, b: 50 },
      legend: { orientation: 'h', y: -0.2 },
      hovermode: 'x unified',
    }, { responsive: true, displayModeBar: false });
  }

  private updateChartVisibility(): void {
    if (!this.chartEl || !this.chartSeries.length) return;
    // Richiama renderChart per aggiornare la visibilità
    this.renderChart();
  }
}
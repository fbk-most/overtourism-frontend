import { Component, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { AdditionalLabelMeta, Comune, FlowDataEnvelope, GeoDataEnvelope, IndicatorMeta, IndiciFilterState, ShowOption, VariationSeries } from '../../models/indici.model';
import { IndiciService } from '../../services/indici.service';
import { IndiciFiltersComponent } from './components/indici-fitlers/indici-filters.component';

@Component({
  selector: 'app-indici',
  templateUrl: './indici.component.html',
  styleUrls: ['./indici.component.scss'],
  standalone: false
})
export class IndiciComponent implements OnInit {
  @ViewChild(IndiciFiltersComponent) filtersComp?: IndiciFiltersComponent;

  allIndicators: IndicatorMeta[] = [];
  additionalLabels: AdditionalLabelMeta[] = [];
  allComuni: Comune[] = [];
  allAreas: Comune[] = [];
  codeToName = new Map<string, string>();

  // Dati Mappa e Grafici
  geoEnvelope: GeoDataEnvelope | null = null;
  flowData: FlowDataEnvelope | null = null;
  chartLabels: string[] = [];
  chartSeries: VariationSeries[] = [];
  selectedComuni: string[] = [];
  selectedAreas: string[] = [];

  showOption: ShowOption = 'map';
  /** What the filter bar currently shows (may include changes not applied yet). */
  filterState: IndiciFilterState | null = null;
  /** Filters actually behind the data on screen, per tab (set when "Applica filtri" is pressed). */
  appliedMapState: IndiciFilterState | null = null;
  appliedChartState: IndiciFilterState | null = null;
  loading = false;
  error = '';

  constructor(
    private svc: IndiciService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.svc.getIndicatorList().subscribe({
      next: res => {
        this.allIndicators = res.indicators;
        this.additionalLabels = res.additional_labels || [];
      },
      error: () => this.error = 'Impossibile caricare gli indicatori.'
    });

    this.svc.getSpatialAreas().subscribe(res => {
      this.allComuni = res.comuni || [];
      this.allAreas = res.areas || [];
      this.allComuni.forEach(c => this.codeToName.set(c.code, c.name));
      this.allAreas.forEach(a => this.codeToName.set(a.code, a.name));

      const defaultComune = this.allComuni.find(c => c.code === '-1');
      if (defaultComune) this.selectedComuni = [defaultComune.code];
      const defaultArea = this.allAreas.find(c => c.code === '-1');
      if (defaultArea) this.selectedAreas = [defaultArea.code];
    });
  }

  onFilterStateChange(state: IndiciFilterState): void {
    this.filterState = state;
    this.cdr.detectChanges(); 
  }

  get isChartDisabled(): boolean {
    return !!this.filterState?.enableVariation || !!this.currentMeta?.year_only;
  }

  onGranularityChange(granularity: IndiciFilterState['granularity']): void {
    this.filtersComp?.setGranularity(granularity);
  }

  onTabSelected(event: any): void {
    const label = event?.label?.toLowerCase() || '';
    this.showOption = label.includes('mappa') ? 'map' : 'chart';
    this.filtersComp?.onTabChanged(this.showOption);
  }

  get currentMeta(): IndicatorMeta | undefined {
    return this.allIndicators.find(i => i.value === this.filterState?.indicator);
  }

  get currentMapTitle(): string {
    return this.mapTitleFor(this.filterState);
  }

  private mapTitleFor(state: IndiciFilterState | null): string {
    if (!state) return '';
    const label = this.allIndicators.find(i => i.value === state.indicator)?.label;
    if (state.enableVariation) {
      const meta = this.additionalLabels.find(l => l.value === 'tasso-variazione');
      const prefix = meta?.label || 'Tasso di variazione';
      return label ? `${prefix}: ${label}` : prefix;
    }
    return label || '';
  }

  // ── What the assistant is told about the page ──────────────────────────────────────────────
  // The assistant must describe what the user is LOOKING AT, i.e. the filters behind the data on
  // screen, not a selection that has not been applied yet (the picker itself is reported separately
  // as a form control, so both are known). Before anything is applied we fall back to the selection.

  /** Filters behind the visible tab's data. */
  get assistantState(): IndiciFilterState | null {
    const applied = this.showOption === 'chart' ? this.appliedChartState : this.appliedMapState;
    return applied ?? this.filterState;
  }

  get assistantMapState(): IndiciFilterState | null {
    return this.appliedMapState ?? this.filterState;
  }

  get assistantChartState(): IndiciFilterState | null {
    return this.appliedChartState ?? this.filterState;
  }

  get assistantMapTitle(): string {
    return this.mapTitleFor(this.assistantMapState);
  }

  get assistantChartLabel(): string {
    const indicator = this.assistantChartState?.indicator;
    return this.allIndicators.find(i => i.value === indicator)?.label || '';
  }

  get selectedTerritories(): string[] {
    if (this.filterState?.showOption !== 'chart') return [];
    const codes = this.filterState.spatialGranularity === 'comune'
      ? this.selectedComuni
      : this.selectedAreas;
    return codes
      .map(code => this.codeToName.get(code))
      .filter((name): name is string => !!name);
  }

  get selectedTerritoriesJson(): string | null {
    const territories = this.selectedTerritories;
    return territories.length ? JSON.stringify(territories) : null;
  }

  get unitDescription(): string {
    if (!this.filterState) return '';
    if (this.filterState.enableVariation) {
      return this.additionalLabels.find(l => l.value === 'tasso-variazione')?.index_value_unit_description || 'Percentuale di variazione';
    }
    return this.currentMeta?.index_value_unit_description || '';
  }

  get colorScaleMode(): 'linear' | 'log' {
    if (this.filterState?.enableVariation) return 'linear';
    return ['indice-densita-turistica', 'turismo-sommerso'].includes(this.filterState?.indicator || '') ? 'log' : 'linear';
  }

  onApplyFilters(filters: IndiciFilterState): void {
    this.filterState = filters;
    if (filters.showOption === 'chart') this.appliedChartState = filters;
    else this.appliedMapState = filters;
    this.loading = true;
    this.error = '';
    this.flowData = null;

    if (filters.showOption === 'chart') {
      this.svc.getVariationData(
        filters.indicator, filters.startDate, filters.endDate,
        filters.granularity, filters.spatialGranularity
      ).subscribe({
        next: res => {
          this.chartLabels = res.labels;
          this.chartSeries = res.series;
          this.loading = false;
        },
        error: () => {
          this.error = 'Errore nel caricamento dati del grafico.';
          this.loading = false;
        }
      });
    } else {
      if (filters.enableVariation) {
        this.svc.getIndexData(
          'tasso-variazione', filters.startDate, filters.endDate,
          filters.spatialGranularity, filters.indicator,
          filters.startDateComparison, filters.endDateComparison
        ).subscribe({
          next: res => {
            this.geoEnvelope = res.geo_data;
            this.flowData = res.flows || null;
            this.loading = false;
          },
          error: () => { this.error = 'Errore nel caricamento dati mappa.'; this.loading = false; }
        });
      } else {
        this.svc.getIndexData(
          filters.indicator, filters.startDate, filters.endDate, filters.spatialGranularity
        ).subscribe({
          next: res => {
            this.geoEnvelope = res.geo_data;
            this.flowData = res.flows || null;
            this.loading = false;
          },
          error: () => { this.error = 'Errore nel caricamento dati mappa.'; this.loading = false; }
        });
      }
    }
  }
}
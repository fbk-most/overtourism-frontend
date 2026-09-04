import { Component, OnInit, ViewChild } from '@angular/core';
import { AdditionalLabelMeta, Comune, GeoDataEnvelope, IndicatorMeta, IndiciFilterState, ShowOption, VariationSeries } from '../../models/indici.model';
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
  chartLabels: string[] = [];
  chartSeries: VariationSeries[] = [];
  selectedComuni: string[] = [];
  selectedAreas: string[] = [];

  showOption: ShowOption = 'map';
  filterState: IndiciFilterState | null = null;
  loading = false;
  error = '';

  constructor(private svc: IndiciService) {}

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
    if (!this.filterState) return '';
    if (this.filterState.enableVariation) {
      const meta = this.additionalLabels.find(l => l.value === 'tasso-variazione');
      const prefix = meta?.label || 'Tasso di variazione';
      return this.currentMeta?.label ? `${prefix}: ${this.currentMeta.label}` : prefix;
    }
    if (this.filterState.enableImpactPercentage) {
      const meta = this.additionalLabels.find(l => l.value === 'incidenza-periodo');
      const prefix = meta?.label || 'Incidenza percentuale del periodo';
      return this.currentMeta?.label ? `${prefix}: ${this.currentMeta.label}` : prefix;
    }
    return this.currentMeta?.label || '';
  }

  get unitDescription(): string {
    if (!this.filterState) return '';
    if (this.filterState.enableVariation) {
      return this.additionalLabels.find(l => l.value === 'tasso-variazione')?.index_value_unit_description || 'Percentuale di variazione';
    }
    if (this.filterState.enableImpactPercentage) {
      return this.additionalLabels.find(l => l.value === 'incidenza-periodo')?.index_value_unit_description || 'Percentuale di impatto';
    }
    return this.currentMeta?.index_value_unit_description || '';
  }

  get colorScaleMode(): 'linear' | 'log' {
    if (this.filterState?.enableVariation || this.filterState?.enableImpactPercentage) return 'linear';
    return ['indice-densita-turistica', 'turismo-sommerso'].includes(this.filterState?.indicator || '') ? 'log' : 'linear';
  }

  onApplyFilters(filters: IndiciFilterState): void {
    this.filterState = filters;
    this.loading = true;
    this.error = '';

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
          'tasso-variazione', filters.startDate, filters.endDate, undefined,
          filters.spatialGranularity, filters.indicator,
          filters.startDateComparison, filters.endDateComparison
        ).subscribe({
          next: res => { this.geoEnvelope = res.geo_data; this.loading = false; },
          error: () => { this.error = 'Errore nel caricamento dati mappa.'; this.loading = false; }
        });
      } else if (filters.enableImpactPercentage) {
        this.svc.getIndexData(
          'incidenza-periodo', filters.startDate, filters.endDate,
          filters.impactSeasonality, filters.spatialGranularity, filters.indicator
        ).subscribe({
          next: res => { this.geoEnvelope = res.geo_data; this.loading = false; },
          error: () => { this.error = 'Errore nel caricamento dati mappa.'; this.loading = false; }
        });
      } else {
        this.svc.getIndexData(
          filters.indicator, filters.startDate, filters.endDate, undefined, filters.spatialGranularity
        ).subscribe({
          next: res => { this.geoEnvelope = res.geo_data; this.loading = false; },
          error: () => { this.error = 'Errore nel caricamento dati mappa.'; this.loading = false; }
        });
      }
    }
  }
}
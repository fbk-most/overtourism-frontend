import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { AdditionalLabelMeta, IndicatorMeta, IndiciFilterState, ShowOption, TemporalGranularity } from '../../../../models/indici.model';

@Component({
  selector: 'app-indici-filters',
  templateUrl: './indici-filters.component.html',
  styleUrls: ['./indici-filters.component.scss'],
  standalone: false
})
export class IndiciFiltersComponent implements OnInit {
  @Input() allIndicators: IndicatorMeta[] = [];
  @Input() additionalLabels: AdditionalLabelMeta[] = [];
  @Input() showOption: ShowOption = 'map';
  @Input() loading = false;
  @Input() hasData = false;

  @Output() apply = new EventEmitter<IndiciFilterState>();
  @Output() stateChange = new EventEmitter<IndiciFilterState>();

  selectedIndicator = '';
  spatialGranularity: 'comune' | 'macro_area' = 'comune';
  startDate = '';
  endDate = '';
  granularity: TemporalGranularity = 'annuale';
  enableVariation = false;
  startDateComparison = '';
  endDateComparison = '';
  enableImpactPercentage = false;
  impactSeasonality = 'weekend';

  visibleIndicators: IndicatorMeta[] = [];
  isDirty = false;
  error = '';

  get currentMeta(): IndicatorMeta | undefined {
    return this.allIndicators.find(i => i.value === this.selectedIndicator);
  }

  get variationMeta(): AdditionalLabelMeta | undefined {
    return this.additionalLabels.find(l => l.value === 'tasso-variazione');
  }

  get impactMeta(): AdditionalLabelMeta | undefined {
    return this.additionalLabels.find(l => l.value === 'incidenza-periodo');
  }

  get minDateBound(): string | null {
    return this.currentMeta?.years_range ? `${this.currentMeta.years_range.min_year}-01-01` : null;
  }

  get maxDateBound(): string | null {
    return this.currentMeta?.years_range ? `${this.currentMeta.years_range.max_year}-12-31` : null;
  }

  ngOnInit(): void {
    this.updateVisibleIndicators();
    if (this.visibleIndicators.length) {
      this.selectedIndicator = this.visibleIndicators[0].value;
      this.applyYearsRange();
    }
    this.emitState();
  }

  onTabChanged(showOption: ShowOption): void {
    this.showOption = showOption;
    this.updateVisibleIndicators();
    this.markDirty();
    this.emitState();
  }

  selectIndicator(value: string): void {
    this.selectedIndicator = value;
    this.applyYearsRange();
    this.markDirty();
    this.emitState();
  }

  onVariationToggle(): void {
    if (this.enableVariation) this.enableImpactPercentage = false;
    this.updateVisibleIndicators();
    this.markDirty();
    this.emitState();
  }

  onImpactPercentageToggle(): void {
    if (this.enableImpactPercentage) this.enableVariation = false;
    this.updateVisibleIndicators();
    this.markDirty();
    this.emitState();
  }

  markDirty(): void {
    this.isDirty = true;
    this.emitState();
  }

  submit(): void {
    this.error = '';
    if (!this.checkDateBounds()) return;
    this.isDirty = false;
    this.apply.emit(this.getCurrentFilterState());
  }

  private applyYearsRange(): void {
    const meta = this.currentMeta;
    if (!meta?.years_range) return;
    const { max_year } = meta.years_range;
    this.startDate = `${max_year}-01-01`;
    this.endDate = `${max_year}-12-31`;
    this.startDateComparison = `${max_year}-01-01`;
    this.endDateComparison = `${max_year}-12-31`;
  }

  private updateVisibleIndicators(): void {
    const isVariation = this.enableVariation || this.showOption === 'chart';
    this.visibleIndicators = isVariation
      ? this.allIndicators.filter(i => i.availableForVariation !== false)
      : this.allIndicators;

    if (!this.visibleIndicators.find(i => i.value === this.selectedIndicator)) {
      this.selectedIndicator = this.visibleIndicators[0]?.value ?? '';
    }
  }

  private checkDateBounds(): boolean {
    if (this.startDate && this.endDate && this.startDate > this.endDate) {
      this.error = "La data di 'Fine periodo' non può essere precedente a 'Inizio periodo'.";
      return false;
    }
    if (this.showOption === 'map' && this.enableVariation) {
      if (this.startDateComparison && this.endDateComparison && this.startDateComparison > this.endDateComparison) {
        this.error = "La data di 'Fine confronto' non può essere precedente a 'Inizio confronto'.";
        return false;
      }
      if (this.startDate === this.startDateComparison && this.endDate === this.endDateComparison) {
        this.error = 'Il periodo di confronto non può coincidere esattamente con il periodo base.';
        return false;
      }
    }
    const minBound = this.minDateBound;
    const maxBound = this.maxDateBound;
    if (minBound && maxBound) {
      const isOut = (d: string) => d && (d < minBound || d > maxBound);
      if (isOut(this.startDate) || isOut(this.endDate)) {
        this.error = `Le date devono essere comprese tra il ${this.currentMeta?.years_range.min_year} e il ${this.currentMeta?.years_range.max_year}.`;
        return false;
      }
    }
    return true;
  }

  private getCurrentFilterState(): IndiciFilterState {
    return {
      indicator: this.selectedIndicator,
      spatialGranularity: this.spatialGranularity,
      startDate: this.startDate,
      endDate: this.endDate,
      granularity: this.granularity,
      enableVariation: this.enableVariation,
      startDateComparison: this.startDateComparison,
      endDateComparison: this.endDateComparison,
      enableImpactPercentage: this.enableImpactPercentage,
      impactSeasonality: this.impactSeasonality,
      showOption: this.showOption
    };
  }

  private emitState(): void {
    this.stateChange.emit(this.getCurrentFilterState());
  }
}
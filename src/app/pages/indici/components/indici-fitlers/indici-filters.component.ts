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

  private impactSeasonalityLabels: Record<string, string> = {
    'weekend': 'Weekend',
    'weekdays': 'Giorni feriali',
    'festivities': 'Festività',
    'summer-months': 'Mesi estivi',
    'winter-months': 'Mesi invernali'
  };

  get impactSeasonalityLabel(): string {
    return this.impactSeasonalityLabels[this.impactSeasonality] || this.impactSeasonality;
  }

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
    this.checkDateBounds()
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

  // Helper per verificare se una data YYYY-MM-DD esiste realmente nel calendario
  private isValidCalendarDate(dStr: string): boolean {
    if (!dStr || typeof dStr !== 'string') return false;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dStr);
    if (!match) return false;

    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const d = parseInt(match[3], 10);

    if (m < 1 || m > 12 || d < 1 || d > 31) return false;

    // Se passi il 31 giugno a Date(), JavaScript fa rollover al 1 luglio
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && (date.getMonth() + 1) === m && date.getDate() === d;
  }
  
  private checkDateBounds(): boolean {
    this.error = '';

    // 1. Presenza e validità reale data inizio
    if (!this.startDate) {
      this.error = "Inserire una data valida per 'Inizio periodo'.";
      return false;
    }
    if (!this.isValidCalendarDate(this.startDate)) {
      this.error = "La data di 'Inizio periodo' non è valida o non esiste nel calendario.";
      return false;
    }

    // 2. Presenza e validità reale data fine
    if (!this.endDate) {
      this.error = "Inserire una data valida per 'Fine periodo'.";
      return false;
    }
    if (!this.isValidCalendarDate(this.endDate)) {
      this.error = "La data di 'Fine periodo' non è valida o non esiste nel calendario.";
      return false;
    }

    // 3. Ordine cronologico
    if (this.startDate > this.endDate) {
      this.error = "La data di 'Fine periodo' non può essere precedente a 'Inizio periodo'.";
      return false;
    }

    // 4. Sezione variazione (se attiva)
    if (this.showOption === 'map' && this.enableVariation) {
      if (!this.startDateComparison || !this.isValidCalendarDate(this.startDateComparison)) {
        this.error = "La data di 'Inizio confronto' non è valida o non esiste nel calendario.";
        return false;
      }
      if (!this.endDateComparison || !this.isValidCalendarDate(this.endDateComparison)) {
        this.error = "La data di 'Fine confronto' non è valida o non esiste nel calendario.";
        return false;
      }
      if (this.startDateComparison > this.endDateComparison) {
        this.error = "La data di 'Fine confronto' non può essere precedente a 'Inizio confronto'.";
        return false;
      }
      if (this.startDate === this.startDateComparison && this.endDate === this.endDateComparison) {
        this.error = 'Il periodo di confronto non può coincidere esattamente con il periodo base.';
        return false;
      }
    }

    // 5. Rispetto del range di anni ammesso dall'indicatore
    const minBound = this.minDateBound;
    const maxBound = this.maxDateBound;
    if (minBound && maxBound) {
      const isOut = (d: string) => d && (d < minBound || d > maxBound);
      if (isOut(this.startDate) || isOut(this.endDate)) {
        this.error = `Le date devono essere comprese tra il ${this.currentMeta?.years_range.min_year} e il ${this.currentMeta?.years_range.max_year}.`;
        return false;
      }
      if (this.showOption === 'map' && this.enableVariation) {
        if (isOut(this.startDateComparison) || isOut(this.endDateComparison)) {
          this.error = `Le date di confronto devono essere comprese tra il ${this.currentMeta?.years_range.min_year} e il ${this.currentMeta?.years_range.max_year}.`;
          return false;
        }
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
import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { AdditionalLabelMeta, IndicatorMeta, IndiciFilterState, ShowOption, TemporalGranularity } from '../../../../models/indici.model';

@Component({
  selector: 'app-indici-filters',
  templateUrl: './indici-filters.component.html',
  styleUrls: ['./indici-filters.component.scss'],
  standalone: false
})
export class IndiciFiltersComponent implements OnInit, OnDestroy {
  @Input() allIndicators: IndicatorMeta[] = [];
  @Input() additionalLabels: AdditionalLabelMeta[] = [];
  @Input() showOption: ShowOption = 'map';
  @Input() loading = false;
  @Input() hasData = false;

  @Output() apply = new EventEmitter<IndiciFilterState>();
  @Output() stateChange = new EventEmitter<IndiciFilterState>();

  selectedIndicator = '';
  spatialGranularity: 'comune' | 'macro_area' | 'provincia' = 'comune';
  startDate = '';
  endDate = '';
  granularity: TemporalGranularity = 'mensile';
  enableVariation = false;
  startDateComparison = '';
  endDateComparison = '';
  indicatorSearch = '';
  indicatorMenuOpen = false;
  descriptionExpanded = false;
  visibleIndicators: IndicatorMeta[] = [];
  isDirty = false;
  error = '';

  // Gruppi calcolati una sola volta (non in un getter): un getter che restituisce
  // nuovi array/oggetti a ogni change detection fa ricreare tutti i bottoni del menu,
  // quindi il click (mousedown + mouseup sullo stesso elemento) non arriva mai.
  indicatorGroups: { category: string; indicators: IndicatorMeta[] }[] = [];

  constructor(private elementRef: ElementRef<HTMLElement>, private cdr: ChangeDetectorRef) {}

  // Listener in fase di capture: funziona anche se altri componenti (mappa, tab, ecc.)
  // fermano la propagazione degli eventi prima che arrivino a `document`.
  private readonly onDocumentPointerDown = (event: Event): void => {
    if (!this.indicatorMenuOpen) return;
    const picker = this.elementRef.nativeElement.querySelector('.indicator-picker');
    if (!(event.target instanceof Node) || !picker?.contains(event.target)) {
      this.closeIndicatorMenu();
    }
  };

  toggleIndicatorMenu(): void {
    this.indicatorMenuOpen = !this.indicatorMenuOpen;
    if (this.indicatorMenuOpen) this.refreshIndicatorGroups();
  }

  closeIndicatorMenu(): void {
    this.indicatorMenuOpen = false;
    this.cdr.markForCheck();
  }

  onIndicatorSearchChange(value: string): void {
    this.indicatorSearch = value;
    this.refreshIndicatorGroups();
  }

  trackByCategory = (_: number, group: { category: string }) => group.category;
  trackByValue = (_: number, indicator: IndicatorMeta) => indicator.value;

  get currentMeta(): IndicatorMeta | undefined {
    return this.allIndicators.find(i => i.value === this.selectedIndicator);
  }

  get variationMeta(): AdditionalLabelMeta | undefined {
    return this.additionalLabels.find(l => l.value === 'tasso-variazione');
  }

  private refreshIndicatorGroups(): void {
    const search = this.indicatorSearch.trim().toLocaleLowerCase();
    const groups = new Map<string, IndicatorMeta[]>();

    this.visibleIndicators
      .filter(indicator => !search || indicator.label.toLocaleLowerCase().includes(search))
      .forEach(indicator => {
        const category = this.indicatorCategory(indicator);
        groups.set(category, [...(groups.get(category) ?? []), indicator]);
      });

    this.indicatorGroups = Array.from(groups, ([category, indicators]) => ({ category, indicators }));
  }

  get yearOptions(): number[] {
    const range = this.currentMeta?.years_range;
    return range
      ? Array.from({ length: range.max_year - range.min_year + 1 }, (_, index) => range.min_year + index)
      : [];
  }

  get selectedYear(): number {
    return Number(this.startDate.slice(0, 4));
  }

  get minDateBound(): string | null {
    return this.currentMeta?.years_range ? `${this.currentMeta.years_range.min_year}-01-01` : null;
  }

  get maxDateBound(): string | null {
    return this.currentMeta?.years_range ? `${this.currentMeta.years_range.max_year}-12-31` : null;
  }

  ngOnInit(): void {
    document.addEventListener('pointerdown', this.onDocumentPointerDown, true);
    this.updateVisibleIndicators();
    if (this.visibleIndicators.length) {
      this.selectedIndicator = this.visibleIndicators[0].value;
      this.applyYearsRange();
    }
    this.emitState();
  }

  ngOnDestroy(): void {
    document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
  }

  onTabChanged(showOption: ShowOption): void {
    if (showOption === 'chart' && this.currentMeta?.year_only) return;
    this.showOption = showOption;
    this.updateVisibleIndicators();
    this.markDirty();
    this.emitState();
  }

  selectIndicator(value: string): void {
    const indicator = this.allIndicators.find(item => item.value === value);
    if (!indicator || this.isIndicatorDisabled(indicator)) return;

    this.selectedIndicator = value;
    this.indicatorMenuOpen = false;
    this.indicatorSearch = '';
    this.refreshIndicatorGroups();
    this.descriptionExpanded = false;
    if (this.currentMeta?.year_only) this.enableVariation = false;
    this.applyYearsRange();
    this.markDirty();
    this.emitState();
  }

  selectYear(year: number): void {
    this.startDate = `${year}-01-01`;
    this.endDate = `${year}-12-31`;
    this.markDirty();
  }

  setGranularity(granularity: TemporalGranularity): void {
    this.granularity = granularity;
    this.markDirty();
  }

  onVariationToggle(): void {
    if (this.currentMeta?.year_only) this.enableVariation = false;
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
    const isChart = this.showOption === 'chart';
    const isVariation = this.enableVariation || isChart;
    const previousIndicator = this.selectedIndicator;
    this.visibleIndicators = isChart
      ? this.allIndicators
      : isVariation
      ? this.allIndicators.filter(i => i.availableForVariation !== false && !i.year_only)
      : this.allIndicators;

    const selectedIsAvailable = this.visibleIndicators.some(indicator =>
      indicator.value === this.selectedIndicator && !this.isIndicatorDisabled(indicator)
    );
    if (!selectedIsAvailable) {
      this.selectedIndicator = this.visibleIndicators.find(indicator => !this.isIndicatorDisabled(indicator))?.value ?? '';
      if (this.selectedIndicator !== previousIndicator) this.applyYearsRange();
    }
    this.refreshIndicatorGroups();
  }

  isIndicatorDisabled(indicator: IndicatorMeta): boolean {
    return this.showOption === 'chart' && (indicator.availableForVariation === false || !!indicator.year_only);
  }

  indicatorCategory(indicator: IndicatorMeta): string {
    const separator = indicator.label.indexOf(' - ');
    return separator === -1 ? 'Altri indicatori' : indicator.label.slice(0, separator);
  }

  indicatorDisplayName(indicator: IndicatorMeta): string {
    const separator = indicator.label.indexOf(' - ');
    if (separator === -1) return indicator.label;

    const category = indicator.label.slice(0, separator);
    const name = indicator.label.slice(separator + 3);
    return name.startsWith(`${category} - `) ? name.slice(category.length + 3) : name;
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
      showOption: this.showOption
    };
  }

  private emitState(): void {
    this.stateChange.emit(this.getCurrentFilterState());
  }
}
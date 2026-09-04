import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import Plotly from 'plotly.js-dist-min';
import { Comune, TemporalGranularity, VariationSeries } from '../../../../models/indici.model';
import { IndiciChartService } from '../services/indici-chart.service';

@Component({
  selector: 'app-indici-chart',
  templateUrl: './indici-charts.component.html',
  styleUrls: ['./indici-charts.component.scss'],
  standalone: false
})
export class IndiciChartComponent implements OnChanges {
  @Input() chartLabels: string[] = [];
  @Input() chartSeries: VariationSeries[] = [];
  @Input() allComuni: Comune[] = [];
  @Input() allAreas: Comune[] = [];
  @Input() selectedComuni: string[] = [];
  @Input() selectedAreas: string[] = [];
  @Input() spatialGranularity: 'comune' | 'macro_area' = 'comune';
  @Input() granularity: TemporalGranularity = 'annuale';
  @Input() chartTitle = '';
  @Input() unitDescription = '';
  @Input() codeToName = new Map<string, string>();
  @Input() loading = false;

  @Output() selectedComuniChange = new EventEmitter<string[]>();
  @Output() selectedAreasChange = new EventEmitter<string[]>();

  @ViewChild('chartEl') chartEl?: ElementRef;
  chartType: 'scatter' | 'bar' = 'scatter';

  get currentSelection(): string[] {
    return this.spatialGranularity === 'comune' ? this.selectedComuni : this.selectedAreas;
  }

  get availableComuniNames(): string[] {
    return this.allComuni.filter(c => !this.selectedComuni.includes(c.code)).map(c => c.name);
  }

  get availableAreaNames(): string[] {
    return this.allAreas.filter(a => !this.selectedAreas.includes(a.code)).map(a => a.name);
  }

  constructor(private chartSvc: IndiciChartService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (this.chartSeries.length && (changes['chartSeries'] || changes['selectedComuni'] || changes['selectedAreas'] || changes['granularity'])) {
      setTimeout(() => this.render(), 30);
    }
  }

  render(): void {
    if (!this.chartEl || !this.chartSeries.length) return;

    const traces = this.chartSvc.buildTraces(
      this.chartLabels,
      this.chartSeries,
      this.currentSelection,
      this.codeToName,
      this.chartType,
      this.granularity
    );

    const layout = this.chartSvc.buildLayout(this.chartTitle, this.unitDescription, this.granularity);

    Plotly.react(this.chartEl.nativeElement, traces, layout, {
      responsive: true,
      displayModeBar: false,
      locale: 'it'
    });
  }

  onComuneSelected(name: string): void {
    const comune = this.allComuni.find(c => c.name === name);
    if (comune && !this.selectedComuni.includes(comune.code)) {
      if (this.selectedComuni.length >= 10) return;
      this.selectedComuniChange.emit([...this.selectedComuni, comune.code]);
    }
  }

  onAreaSelected(name: string): void {
    const area = this.allAreas.find(a => a.name === name);
    if (area && !this.selectedAreas.includes(area.code)) {
      if (this.selectedAreas.length >= 10) return;
      this.selectedAreasChange.emit([...this.selectedAreas, area.code]);
    }
  }

  removeSelection(code: string): void {
    if (this.spatialGranularity === 'comune') {
      this.selectedComuniChange.emit(this.selectedComuni.filter(c => c !== code));
    } else {
      this.selectedAreasChange.emit(this.selectedAreas.filter(a => a !== code));
    }
  }
}
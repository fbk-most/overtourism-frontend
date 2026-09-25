import { Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import Plotly from 'plotly.js-dist-min';
import { SharedTimeSeriesPayload } from '../../../models/shared-chart.model';
import { IndiciChartService } from '../../../pages/indici/components/services/indici-chart.service';

@Component({
  selector: 'app-shared-line-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shared-line-chart.component.html',
  styleUrls: ['./shared-line-chart.component.scss']
})
export class SharedLineChartComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() payload: SharedTimeSeriesPayload | null = null;
  @Input() loading = false;

  @ViewChild('chartContainer') chartContainer?: ElementRef<HTMLElement>;

  private resizeListener = () => this.resize();

  constructor(private chartSvc: IndiciChartService) {}

  ngAfterViewInit(): void {
    window.addEventListener('resize', this.resizeListener);
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.chartContainer && (changes['payload'] || changes['loading'])) {
      setTimeout(() => this.render(), 30);
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeListener);
    if (this.chartContainer?.nativeElement) {
      Plotly.purge(this.chartContainer.nativeElement);
    }
  }

  private render(): void {
    if (!this.chartContainer || !this.payload?.series?.length) return;

    const codeToNameMap = this.normalizeCodeToName(this.payload.codeToName);
    const selected = this.payload.selectedItems && this.payload.selectedItems.length > 0
      ? this.payload.selectedItems
      : this.payload.series.map(s => s.label);

    const traces = this.chartSvc.buildTraces(
      this.payload.labels || [],
      this.payload.series,
      selected,
      codeToNameMap,
      'scatter',
      this.payload.granularity || 'annuale'
    );

    const layout = this.chartSvc.buildLayout(
      this.payload.title || '',
      this.payload.unitDescription || '',
      this.payload.granularity || 'annuale'
    );

    Plotly.react(this.chartContainer.nativeElement, traces, layout, {
      responsive: true,
      displayModeBar: false,
      locale: 'it'
    });
  }

  private resize(): void {
    if (this.chartContainer?.nativeElement) {
      Plotly.Plots.resize(this.chartContainer.nativeElement);
    }
  }

  private normalizeCodeToName(input?: Record<string, string> | Map<string, string>): Map<string, string> {
    if (!input) return new Map();
    if (input instanceof Map) return input;
    return new Map(Object.entries(input));
  }
}
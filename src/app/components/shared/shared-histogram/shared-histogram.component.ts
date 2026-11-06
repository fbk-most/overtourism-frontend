import { Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import Plotly from 'plotly.js-dist-min';
import { TranslateService } from '@ngx-translate/core';
import { SharedHistogramPayload } from '../../../models/plot.model';
import { getComparisonChartKpis, getKpiLabel } from '../../../utils/kpi.utils';

@Component({
  selector: 'app-shared-histogram',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shared-histogram.component.html'
})
export class SharedHistogramComponent implements AfterViewInit, OnChanges {
  @Input() payload!: SharedHistogramPayload | null;
  @Input() loading: boolean = false;
  @Input() kpiMapper: Record<string, string> = {};
  @ViewChild('histogramChart', { static: false }) chartEl!: ElementRef<HTMLElement>;

  constructor(private translate: TranslateService) { }

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['payload'] || changes['kpiMapper']) && !this.loading) {
      this.renderChart();
    }
  }

  private wrapLabel(label: string, maxChars = 12): string {
    return label.replace(
      new RegExp(`(.{1,${maxChars}})(\\s|$)`, 'g'),
      '$1<br>'
    );
  }
  private getKpiLabel(key: string): string {
    const mappedLabel = getKpiLabel(key, this.kpiMapper);
    if (mappedLabel !== key) return mappedLabel;

    const translationKey = `kpi.${key.toLowerCase().trim().replace(/\s+/g, '_')}`;
    const translatedLabel = this.translate.instant(translationKey);
    return translatedLabel === translationKey ? key : translatedLabel;
  }
  private renderChart(): void {
    if (!this.chartEl?.nativeElement || !this.payload) return;

    const { labelLeft, labelRight } = this.payload;
    const dataLeft = getComparisonChartKpis(this.payload.dataLeft);
    const dataRight = getComparisonChartKpis(this.payload.dataRight);

    const categories = Array.from(new Set([
      ...Object.keys(dataLeft || {}),
      ...Object.keys(dataRight || {})
    ]));
    
    const wrappedCategories = categories.map(c => this.wrapLabel(this.getKpiLabel(c)));

    const valuesLeft = categories.map(c => this.kpiLevel(dataLeft[c]));
    const errorsLeft = categories.map(c => this.kpiConfidence(dataLeft[c]));

    const valuesRight = categories.map(c => this.kpiLevel(dataRight[c]));
    const errorsRight = categories.map(c => this.kpiConfidence(dataRight[c]));

    const displayLeft = valuesLeft.map(v => +v.toFixed(1));
    const displayRight = valuesRight.map(v => +v.toFixed(1));
    const errLeftRounded = errorsLeft.map(e => +e.toFixed(1));
    const errRightRounded = errorsRight.map(e => +e.toFixed(1));

    const barWidth = 0.38;

    const leftMain: any = {
      x: wrappedCategories, y: displayLeft, name: labelLeft, type: 'bar',
      marker: { color: '#0066CC' }, offsetgroup: 'left', width: barWidth
    };
    const leftConf: any = {
      x: wrappedCategories, y: errLeftRounded.map(e => e * 2),
      base: displayLeft.map((v, i) => v - errLeftRounded[i]), type: 'bar',
      marker: { color: '#e7b66e' }, opacity: 1, name: `${labelLeft} conf`,
      hoverinfo: 'skip', showlegend: false, offsetgroup: 'left', width: barWidth,
      text: displayLeft.map(v => v.toFixed(1)), textposition: 'outside'
    };
    const leftLevelLine: any = {
      x: wrappedCategories, y: displayLeft.map(() => 0.02), base: displayLeft,
      type: 'bar', marker: { color: 'black' }, hoverinfo: 'skip',
      showlegend: false, offsetgroup: 'left', width: barWidth
    };

    const rightMain: any = {
      x: wrappedCategories, y: displayRight, name: labelRight, type: 'bar',
      marker: { color: '#D9D9D9' }, offsetgroup: 'right', width: barWidth
    };
    const rightConf: any = {
      x: wrappedCategories, y: errRightRounded.map(e => e * 2),
      base: displayRight.map((v, i) => v - errRightRounded[i]), type: 'bar',
      marker: { color: '#e7b66e' }, opacity: 1, name: `${labelRight} conf`,
      hoverinfo: 'skip', showlegend: false, offsetgroup: 'right', width: barWidth,
      text: displayRight.map(v => v.toFixed(1)), textposition: 'outside'
    };
    const rightLevelLine: any = {
      x: wrappedCategories, y: displayRight.map(() => 0.02), base: displayRight,
      type: 'bar', marker: { color: 'black' }, hoverinfo: 'skip',
      showlegend: false, offsetgroup: 'right', width: barWidth
    };

    const uncertaintyLegend: any = {
      x: [null], y: [null], type: 'bar', marker: { color: '#e7b66e' },
      name: this.translate.instant('plot.labels.uncertainty'),
      showlegend: true, hoverinfo: 'skip'
    };

    const layout: Partial<Plotly.Layout> = {
      barmode: 'group',
      margin: { t: 20, r: 20, l: 40, b: 70 },
      legend: { orientation: 'h', y: -0.25, x: 0.5, xanchor: 'center' },
      xaxis: { automargin: true },
      yaxis: { automargin: true }
    };

    const traces: any[] = [
      leftMain, rightMain,
      leftConf, rightConf,
      leftLevelLine, rightLevelLine,
      uncertaintyLegend
    ];

    Plotly.newPlot(this.chartEl.nativeElement, traces, layout, { responsive: true });
  }

  private kpiLevel(value: unknown): number {
    if (typeof value === 'number') return value;
    if (value !== null && typeof value === 'object') {
      const level = (value as Record<string, unknown>)['level'];
      if (typeof level === 'number') return level;
    }
    return 0;
  }

  private kpiConfidence(value: unknown): number {
    if (value !== null && typeof value === 'object') {
      const confidence = (value as Record<string, unknown>)['confidence'];
      if (typeof confidence === 'number') return confidence;
    }
    return 0;
  }
}
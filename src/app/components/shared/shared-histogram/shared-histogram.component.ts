import { Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import Plotly from 'plotly.js-dist-min';
import { SharedHistogramPayload } from '../../../models/plot.model'; 

@Component({
  selector: 'app-shared-histogram',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shared-histogram.component.html'
})
export class SharedHistogramComponent implements AfterViewInit, OnChanges {
  @Input() payload!: SharedHistogramPayload | null;
  @Input() loading: boolean = false;

  @ViewChild('histogramChart', { static: false }) chartEl!: ElementRef<HTMLElement>;

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['payload'] && !this.loading) {
      this.renderChart();
    }
  }

  private wrapLabel(label: string, maxChars = 12): string {
    return label.replace(
      new RegExp(`(.{1,${maxChars}})(\\s|$)`, 'g'),
      '$1<br>'
    );
  }

  private renderChart(): void {
    if (!this.chartEl?.nativeElement || !this.payload) return;

    const { dataLeft, dataRight, labelLeft, labelRight } = this.payload;

    const categories = Array.from(new Set([
      ...Object.keys(dataLeft || {}),
      ...Object.keys(dataRight || {})
    ]));
    
    const wrappedCategories = categories.map(c => this.wrapLabel(c));

    const valuesLeft = categories.map(c => +(dataLeft[c]?.level ?? 0));
    const errorsLeft = categories.map(c => +(dataLeft[c]?.confidence ?? 0));

    const valuesRight = categories.map(c => +(dataRight[c]?.level ?? 0));
    const errorsRight = categories.map(c => +(dataRight[c]?.confidence ?? 0));

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
      name: 'Incertezza', showlegend: true, hoverinfo: 'skip'
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
}
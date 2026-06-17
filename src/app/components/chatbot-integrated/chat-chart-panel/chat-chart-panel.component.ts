import { Component, Input, AfterViewInit, OnChanges, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

declare const Plotly: any;

@Component({
  selector: 'app-chat-chart-panel',
  standalone: true,
  imports: [CommonModule],
  template: `<div #chartEl class="chat-chart-panel" style="width:100%;min-height:320px;"></div>`
})
export class ChatChartPanelComponent implements AfterViewInit, OnChanges {
  @Input() figure: any;
  @ViewChild('chartEl') chartEl!: ElementRef;

  ngAfterViewInit() { this.render(); }
  ngOnChanges() { if (this.chartEl) this.render(); }

  render() {
    if (!this.chartEl?.nativeElement || !this.figure) return;
    const layout = {
      ...this.figure.layout,
      autosize: true,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      margin: { l: 48, r: 24, t: this.figure.layout?.title ? 40 : 12, b: 40 }
    };
    Plotly.newPlot(this.chartEl.nativeElement, this.figure.data, layout, {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d']
    });
  }
}
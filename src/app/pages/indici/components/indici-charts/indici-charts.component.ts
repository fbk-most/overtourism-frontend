import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import Plotly from 'plotly.js-dist-min';
import { Comune, TemporalGranularity, VariationSeries } from '../../../../models/indici.model';
import { IndiciChartService } from '../services/indici-chart.service';
import { SharedTimeSeriesPayload } from '../../../../models/shared-chart.model';

@Component({
  selector: 'app-indici-chart',
  templateUrl: './indici-charts.component.html',
  styleUrls: ['./indici-charts.component.scss'],
  standalone: false
})
export class IndiciChartComponent  {
  @Input() chartLabels: string[] = [];
  @Input() chartSeries: VariationSeries[] = [];
  @Input() allComuni: Comune[] = [];
  @Input() allAreas: Comune[] = [];
  @Input() selectedComuni: string[] = [];
  @Input() selectedAreas: string[] = [];
  @Input() spatialGranularity: 'comune' | 'macro_area' = 'comune';
  @Input() granularity: TemporalGranularity = 'mensile';
  @Input() chartTitle = '';
  @Input() unitDescription = '';
  @Input() codeToName = new Map<string, string>();
  @Input() loading = false;

  @Output() selectedComuniChange = new EventEmitter<string[]>();
  @Output() selectedAreasChange = new EventEmitter<string[]>();
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

  get chartPayload(): SharedTimeSeriesPayload {
    return {
      labels: this.chartLabels,
      series: this.chartSeries,
      title: this.chartTitle,
      unitDescription: this.unitDescription,
      granularity: this.granularity,
      selectedItems: this.currentSelection,
      codeToName: this.codeToName
    };
  }


  get hasSelection(): boolean {
    return this.spatialGranularity !== 'comune' || this.selectedComuni.length > 0;
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
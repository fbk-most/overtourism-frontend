import { Type } from '@angular/core';
import { SharedBarChartComponent } from '../shared/shared-bar-chart/shared-bar-chart.component';
import { SharedHistogramComponent } from '../shared/shared-histogram/shared-histogram.component';
import { SharedKpisComponent } from '../shared/shared-kpis/shared-kpis.component';
import { SharedLineChartComponent } from '../shared/shared-line-chart/shared-line-chart.component';
import { SharedPlotComponent } from '../shared/shared-plot/shared-plot.component';
import { IndiciMapComponent } from '../indici-map/indici-map.component';

export const CHAT_WIDGET_REGISTRY: Record<string, Type<any>> = {
  histogramComparison: SharedHistogramComponent,
  indexComparison: SharedKpisComponent,
  plot: SharedPlotComponent,
  loadPlot: SharedPlotComponent,
  map: IndiciMapComponent,
  lineChart: SharedLineChartComponent,
  barChart: SharedBarChartComponent
};

import { Injectable } from '@angular/core';
import Plotly from 'plotly.js-dist-min';
import { VariationSeries, TemporalGranularity } from '../../../../models/indici.model';

const PALETTE = [
  '#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261',
  '#264653', '#6a4c93', '#1982c4', '#8ac926', '#ff595e', '#6a994e',
];

@Injectable({ providedIn: 'root' })
export class IndiciChartService {

  buildTraces(
    chartLabels: string[],
    chartSeries: VariationSeries[],
    currentSelection: string[],
    codeToName: Map<string, string>,
    chartType: 'scatter' | 'bar',
    granularity: TemporalGranularity
  ): Partial<Plotly.PlotData>[] {
    const traces: Partial<Plotly.PlotData>[] = [];

    const xLabels = (granularity === 'mensile')
      ? chartLabels.map(l => new Date(l + '-01'))
      : granularity === 'giornaliero'
        ? chartLabels.map(l => new Date(l))
        : chartLabels;

    chartSeries.forEach((s, i) => {
      const isSelected = currentSelection.length === 0 || currentSelection.includes(s.label);
      const colorIndex = (currentSelection.length > 0 && isSelected)
        ? currentSelection.indexOf(s.label)
        : i;

      const color = PALETTE[colorIndex % PALETTE.length];
      const std = s.std ?? s.data.map(() => 0);
      const name = codeToName.get(s.label) || s.label;

      if (chartType === 'scatter' && isSelected) {
        traces.push({
          x: [...xLabels, ...[...xLabels].reverse()],
          y: [
            ...s.data.map((v, j) => v + std[j]),
            ...[...s.data.map((v, j) => v - std[j])].reverse()
          ],
          fill: 'toself',
          fillcolor: color + '30',
          line: { color: 'transparent' },
          name: `${name} (conf.)`,
          showlegend: false,
          hoverinfo: 'skip'
        } as any);
      }

      const hasStd = s.std && s.std.some(val => val > 0);
      const traceConfig: any = {
        x: xLabels,
        y: s.data,
        type: chartType,
        name,
        customdata: std,
        hovertemplate: hasStd ? `%{y:.2f} ± %{customdata:.2f}<extra></extra>` : `%{y:.2f}<extra></extra>`,
        visible: isSelected,
        showlegend: isSelected,
      };

      if (chartType === 'scatter') {
        traceConfig.mode = 'lines+markers';
        traceConfig.line = { color, width: 2 };
        traceConfig.marker = { color };
      } else {
        traceConfig.marker = { color };
        if (hasStd) {
          traceConfig.error_y = {
            type: 'data',
            array: std,
            visible: true,
            color: '#333333',
            thickness: 1.5,
            width: 3
          };
        }
      }

      traces.push(traceConfig);
    });

    return traces;
  }

  buildLayout(
    title: string,
    unitDescription: string,
    granularity: TemporalGranularity
  ): Partial<Plotly.Layout> {
    const xAxisConfig: Partial<Plotly.LayoutAxis> =
      granularity === 'annuale'
        ? { type: 'linear', tickformat: 'd', dtick: 1 }
        : granularity === 'mensile'
          ? { type: 'date', tickformat: '%b %Y', dtick: 'M1' }
          : { type: 'date', tickformat: '%d %b %Y' };

    const yAxisConfig: Partial<Plotly.LayoutAxis> = unitDescription
      ? { title: { text: unitDescription, font: { size: 12, color: '#666' } } }
      : {};

    return {
      title: { text: title, font: { size: 14 } },
      height: 420,
      margin: { t: 50, l: 50, r: 20, b: 50 },
      legend: { orientation: 'h', y: -0.2 },
      hovermode: 'x unified',
      barmode: 'group',
      xaxis: xAxisConfig,
      yaxis: yAxisConfig,
    };
  }
}
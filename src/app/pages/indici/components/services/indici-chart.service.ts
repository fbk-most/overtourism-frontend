import { Injectable } from '@angular/core';
import Plotly from 'plotly.js-dist-min';
import { VariationSeries, TemporalGranularity } from '../../../../models/indici.model';

const PALETTE = [
  '#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261',
  '#264653', '#6a4c93', '#1982c4', '#8ac926', '#ff595e', '#6a994e',
];

const MONTH_NAMES = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

@Injectable({ providedIn: 'root' })
export class IndiciChartService {

  buildTraces(
    chartLabels: string[],
    chartSeries: VariationSeries[],
    currentSelection: string[],
    codeToName: Map<string, string> | Record<string, string>,
    chartType: 'scatter' | 'bar',
    granularity: TemporalGranularity
  ): Partial<Plotly.PlotData>[] {
    const traces: Partial<Plotly.PlotData>[] = [];

    // Formattazione etichette asse X leggibili
    const xLabels = chartLabels.map(l => {
      if (granularity === 'mensile' && l.includes('-')) {
        const parts = l.split('-');
        const mIdx = parseInt(parts[1], 10) - 1;
        return `${MONTH_NAMES[mIdx] || parts[1]} ${parts[0]}`;
      }
      return l;
    });

    const getName = (code: string): string => {
      if (codeToName instanceof Map) return codeToName.get(code) || code;
      if (codeToName && typeof codeToName === 'object') return (codeToName as Record<string, string>)[code] || code;
      return code;
    };

    // 🔴 FILTRO ANTI-LEGGENDA INFINITA:
    // Seleziona solo le serie esplicitamente richieste. Se nessuna è richiesta ed ce ne sono > 5,
    // mostra solo il totale Trentino ('-1') o le prime 3, mai tutte le 166 insieme!
    let activeSeries: VariationSeries[] = [];
    if (currentSelection && currentSelection.length > 0) {
      activeSeries = chartSeries.filter(s => currentSelection.includes(s.label));
    } else {
      if (chartSeries.length > 5) {
        const defaultSeries = chartSeries.find(s => s.label === '-1');
        activeSeries = defaultSeries ? [defaultSeries] : chartSeries.slice(0, 3);
      } else {
        activeSeries = chartSeries;
      }
    }

    activeSeries.forEach((s, i) => {
      const color = PALETTE[i % PALETTE.length];
      const std = s.std ?? s.data.map(() => 0);
      const name = getName(s.label);
      const hasStd = std.some(val => val > 0);

      // Area di confidenza solo per linee
      if (chartType === 'scatter') {
        traces.push({
          x: [...xLabels, ...[...xLabels].reverse()],
          y: [
            ...s.data.map((v, j) => v + std[j]),
            ...[...s.data.map((v, j) => v - std[j])].reverse()
          ],
          fill: 'toself',
          fillcolor: color + '25',
          line: { color: 'transparent' },
          name: `${name} (conf.)`,
          showlegend: false,
          hoverinfo: 'skip'
        } as any);
      }

      const traceConfig: any = {
        x: xLabels,
        y: s.data,
        type: chartType,
        name,
        customdata: std,
        hovertemplate: hasStd ? `<b>%{x}</b><br>${name}: %{y:.2f} ± %{customdata:.2f}<extra></extra>` : `<b>%{x}</b><br>${name}: %{y:.2f}<extra></extra>`,
        showlegend: true,
      };

      if (chartType === 'scatter') {
        traceConfig.mode = 'lines+markers';
        traceConfig.line = { color, width: 2.5 };
        traceConfig.marker = { color, size: 6 };
      } else {
        // 🔴 LABEL SULLE BARRE CON I VALORI NUMERICI
        traceConfig.marker = { color };
        traceConfig.text = s.data.map(v => (v !== null && v !== undefined && !isNaN(v)) ? Number(v).toFixed(2) : '');
        traceConfig.textposition = 'outside';
        traceConfig.textfont = { size: 10, color: '#333' };

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
    granularity: TemporalGranularity,
    chartType: 'scatter' | 'bar' = 'scatter'
  ): Partial<Plotly.Layout> {
    const xAxisConfig: Partial<Plotly.LayoutAxis> = {
      type: 'category',
      tickangle: chartLabelsCount(granularity) ? -35 : 0,
      automargin: true
    };

    const yAxisConfig: Partial<Plotly.LayoutAxis> = {
      automargin: true,
      title: unitDescription ? { text: unitDescription, font: { size: 12, color: '#666' } } : undefined
    };

    return {
      title: { text: title, font: { size: 14 } },
      height: 440,
      margin: { t: 50, l: 60, r: 30, b: 80 },
      legend: {
        orientation: 'h',
        y: -0.25,
        x: 0.5,
        xanchor: 'center',
        yanchor: 'top'
      },
      hovermode: 'x unified',
      barmode: 'group',
      xaxis: xAxisConfig,
      yaxis: yAxisConfig,
    };
  }
}

function chartLabelsCount(granularity: TemporalGranularity): boolean {
  return granularity === 'mensile' || granularity === 'giornaliero';
}
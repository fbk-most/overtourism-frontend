import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PlotInput, Curve, Point } from '../models/plot.model';
import { ChartSummary, ChartSeriesSummary } from '../models/chart-summary.model';
import Plotly from 'plotly.js-dist-min';
import { DEFAULT_LAYOUT, PLOT_COLORS } from '../components/plot/plot.config';
import { DataFact } from '../models/data-fact.model';

@Injectable({ providedIn: 'root' })
export class PlotService {

  constructor() {

  }
  private dashStyles = ['dot', 'dashdot', 'dash', 'longdash', 'longdashdot'];
  private dashMap = new Map<string, string>();
  private dashIndex = 0;

  getDashForGroup(group: string): string {
    // La curva principale/totale è sempre 'solid'
    if (!group || group === 'default' || group === 'all' || group === 'Tutti') {
      return 'solid';
    }

    // Se abbiamo già assegnato uno stile a questo gruppo, lo riutilizziamo
    if (this.dashMap.has(group.toLowerCase())) {
      return this.dashMap.get(group.toLowerCase())!;
    }

    // Altrimenti peschiamo il prossimo stile disponibile e lo memorizziamo
    const style = this.dashStyles[this.dashIndex % this.dashStyles.length];
    this.dashMap.set(group.toLowerCase(), style);
    this.dashIndex++;

    return style;
  }
  private getBiLabel(plotMapper: any, axis: 'x' | 'y', fallback: string): string {
    return plotMapper?.bidimensional?.[axis]?.label ?? fallback;
  }

  private getMonoLabel(plotMapper: any, axis: 'x' | 'y', fallback: string): string {
    return plotMapper?.monodimensional?.[axis]?.label ?? fallback;
  }

  private extractField(point: any, configuredField: string | undefined, fallbackKeys: string[]): number {
    if (configuredField && point[configuredField] !== undefined) {
      return point[configuredField];
    }
    for (const key of fallbackKeys) {
      if (point[key] !== undefined) return point[key];
    }
    return 0;
  }

  private buildHoverTemplate(labels: { x?: string; y?: string;  name?: string }): string {
    return (labels.name ? `<b>${labels.name}</b><br>` : '') +
           (labels.x ? `<b>${labels.x}:</b> %{x}<br>` : '') +
           (labels.y ? `<b>${labels.y}:</b> %{y}<br>` : '') +
           '<extra></extra>';
  }
  async renderFunctionPlot(sottosistemaSelezionato: string, container: HTMLElement, input: PlotInput) {

    const data: Partial<Plotly.PlotData>[] = [];
    const curvesToRender = sottosistemaSelezionato === 'default'
      ? input.curves
      : input.curves.filter(c => c.name === sottosistemaSelezionato);

      const mapper = (input as any).mapper || [];
const plotMapper = (input as any).plotMapper;

    const xLabel = this.getBiLabel(plotMapper, 'x', 'Turisti');
    const yLabel = this.getBiLabel(plotMapper, 'y', 'Escursionisti');

    for (const curve of curvesToRender) {
      const foundLabel = mapper.find((m: any) => m.value === curve.name);
      const translatedName = foundLabel ? foundLabel.label : curve.name;

      data.push({
        x: curve.x,
        y: curve.y,
        mode: 'lines',
        name: translatedName,
        line: {
          color: curve.color ?? 'black',
          dash: curve.dash ?? 'solid',
          width: 3,
        },
        hoverinfo: 'name',
        type: 'scatter',
      });
    }

    if (input.points?.length) {
      for (const pt of input.points) {
        data.push({
          x: pt.x,
          y: pt.y,
          type: 'scatter',
          mode: 'markers',
          name: pt.name,
          text: pt.name,
          marker: pt.marker ?? {
            color: pt.color ?? 'black',
            size: 8,
            line: { width: 1, color: 'black' },
          },
          hovertemplate: this.buildHoverTemplate({
            name: 'Presenze',
            x: xLabel,
            y: yLabel
          })
        });
      }
    }
    const layout: Partial<Plotly.Layout> = {
      margin: { t: 30, l: 50, r: 30, b: 50 },
      yaxis: {
        title: { text: yLabel },
        range: [0, input.yMax || 10000],
        autorange: false,
        scaleanchor: 'x',
        scaleratio: 1,
        constrain: 'domain',       
        layer: 'below traces',
        rangemode: 'tozero'        
      },
      xaxis: {
        title: { text: xLabel },
        range: [0, input.xMax || 10000],
        autorange: false,
        constrain: 'domain',       
        layer: 'below traces',
        rangemode: 'tozero'        
      },
      title: { text: '' },
      showlegend: true,
      legend: {
        orientation: 'h',
        x: 0,
        y: -0.2,
        xanchor: 'left',
        yanchor: 'top',
      }
    };

    this.renderPlot(container, data, layout);
  }
  private createDataFactsFromKpis(kpis: Record<string, any>): DataFact[] {
    const dataFacts: DataFact[] = [];
  
    // Global overtourism level
    if (kpis['overtourism_level']) {
      dataFacts.push({
        category: 'all',
        violations_percentage: +(kpis['overtourism_level'].level ?? 0).toFixed(1),
        uncertainty: +(kpis['overtourism_level'].confidence ?? 0).toFixed(1),
        violations_numerosity: (kpis['overtourism_level'].level > 0) ? 1 : 0
      });
    }
  
    // Individual constraints
    const constraints = Object.keys(kpis)
    .filter(key => key.startsWith('constraint_level_'))
    .map(key => key.replace('constraint_level_', ''));

    for (const c of constraints) {
      // Ora val è un oggetto {level: number, confidence: number}
      const valObj = kpis[`constraint_level_${c}`];

      if (valObj !== undefined) {
        dataFacts.push({
          category: c, 
          parameter: '',
          original_value: '',
          new_value: '',
          violations_percentage: +Number(valObj.level).toFixed(1),
          uncertainty: +Number(valObj.confidence).toFixed(1),
          violations_numerosity: Number(valObj.level) > 0 ? 1 : 0
        });
      }
    }
  
    return dataFacts;
  }
  
  
  preparePlotInput(module: any, colorScale?: any, mapper?: any, plotMapper?: any): PlotInput { 

    // 🔴 Leggi i field configurati per il bidimensionale (con fallback ai nomi noti)
    const xField = plotMapper?.bidimensional?.x?.field;
    const yField = plotMapper?.bidimensional?.y?.field;
    const usageField = plotMapper?.monodimensional?.y?.field;

    // Curves
    const curves: Curve[] = Object.entries(module.constraint_curves ?? {}).map(
      ([groupName, curveData]: [string, any]) => ({
        x: curveData[0],
        y: curveData[1],
        name: groupName,
        color: 'black',
        dash: this.getDashForGroup(groupName) as 'dot' | 'dashdot' | 'dash' | 'solid' | undefined,
      })
    );

    const heatmapsByFunction: Record<string, number[][]> = module.points.uncertainty_by_constraint ?? {};

    const points = Array.isArray(module.kpis?.uncertainty)
    ? [this.createUncertaintyPoint('Presenze', module.kpis?.uncertainty, false, colorScale, plotMapper) as Point] : [];

    let kpis: any = undefined;
    if (module.kpis && typeof module.kpis === 'object') {
      kpis = {
        overtourism_level: typeof module.kpis.overtourism_level === 'object' 
          ? module.kpis.overtourism_level 
          : { level: module.kpis.overtourism_level ?? 0, confidence: 0 },
        
        critical_constraint: {
          name: module.kpis['critical constraint']?.name ?? '',
          level: module.kpis['critical constraint']?.level ?? 0,
          confidence: module.kpis['critical constraint']?.confidence ?? 0
        },
        
        // 🔴 Usa extractField con fallback ai nomi storici tourists/excursionists/usage
        uncertainty: Array.isArray(module.points?.uncertainty)
          ? module.points.uncertainty.map((u: any) => ({
            tourists: this.extractField(u, xField, ['tourists', 'tourist']),
            excursionists: this.extractField(u, yField, ['excursionists', 'excursionist']),
            index: u.index ?? 0,
            usage: this.extractField(u, usageField, ['usage']),
            usage_uncertainty: u.usage_uncertainty ?? 0,
          }))
          : [],
          
        uncertainty_by_constraint: module.points?.uncertainty_by_constraint && typeof module.points.uncertainty_by_constraint === 'object'
          ? Object.fromEntries(
            Object.entries(module.points.uncertainty_by_constraint).map(([key, value]) => [
              key,
              Array.isArray(value) ? value.map((u: any) => ({
                tourists: this.extractField(u, xField, ['tourists', 'tourist']),
                excursionists: this.extractField(u, yField, ['excursionists', 'excursionist']),
                index: u.index ?? 0,
                usage: this.extractField(u, usageField, ['usage']),
                usage_uncertainty: u.usage_uncertainty ?? 0,
              })) : []
          ])
        ) : {}
      };

      Object.keys(module.kpis).forEach(key => {
        if (key.startsWith('constraint level ')) {
          const cat = key.replace('constraint level ', '');
          const dataObj = module.kpis[key];
          
          if (typeof dataObj === 'object') {
            kpis[`constraint_level_${cat}`] = { 
              level: dataObj.level ?? 0, 
              confidence: dataObj.confidence ?? 0 
            };
          } else {
            kpis[`constraint_level_${cat}`] = { 
              level: dataObj ?? 0, 
              confidence: 0 
            };
          }
        }
      });
    }

    const dataFacts = module.kpis ? this.createDataFactsFromKpis(kpis) : [];

    return {
      curves,
      heatmap: module.uncertainty
        ? {
          x: module.x?.[0] ?? [],
          y: module.y?.map((row: number[]) => row[0]) ?? [],
          z: module.uncertainty,
        }
        : undefined,
      xMax: module.x_max,
      yMax: module.y_max,
      points,
      heatmapsByFunction,
      usage: module.usage ?? [],
      sample_t: module.sample_t ?? [],
      sample_e: module.sample_e ?? [],
      capacity: module.capacity ?? [],
      capacity_mean: module.capacity_mean,
      kpis,
      usage_by_constraint: module.usage_by_constraint ?? {},
      capacity_by_constraint: module.capacity_by_constraint ?? {},
      capacity_mean_by_constraint: module.capacity_mean_by_constraint ?? {},
      dataFacts,
      colorScale,
      mapper,
      plotMapper 
    };
  }
  renderBidimensionale(sottosistemaSelezionato: string, container: HTMLElement, cloned: PlotInput, colorScale?: any) {
    const targetScale = colorScale || (cloned as any).colorScale;
    const plotMapper = (cloned as any).plotMapper;

    const uncertaintyData = this.getUncertaintyData(sottosistemaSelezionato, cloned.kpis);
    cloned.points = [this.createUncertaintyPoint('Presenze', uncertaintyData, false, targetScale, plotMapper) as Point];
    this.renderFunctionPlot(sottosistemaSelezionato, container, cloned);
  }
  async renderMonoDimensionale(sottosistemaSelezionato: string, container: HTMLElement, input: PlotInput, colorScale?: any): Promise<void> {
    if (!container || !input?.kpis) return;

    const uncertaintyData = this.getUncertaintyData(sottosistemaSelezionato, input.kpis);

    if (!uncertaintyData.length) return;

    const sorted = [...uncertaintyData].sort((a, b) => a.usage - b.usage);

    const x = sorted.map((_, i) => i);
    const y = sorted.map(d => d.usage);
    const colorValues = sorted.map(d => d.index);
    const risk = sorted.map(d => 100 * d.index);

    const usageMax = Math.max(...y);
    const yAxisMax = usageMax * 1.2;

    const plotMapper = (input as any).plotMapper;
    // 🔴 Label dinamiche per mono-dimensionale
    const xAxisLabel = this.getMonoLabel(plotMapper, 'x', 'Giorni (ordinati per utilizzo)');
    const yAxisLabelDefault = this.getMonoLabel(plotMapper, 'y', 'Livello di utilizzo della destinazione');

    const hoverTemplate =
    sottosistemaSelezionato === 'default'
      ? 'Giorno: %{x}<br>Utilizzo: %{y:.1f}%<br>Livello di rischio: %{customdata:.1f}%<extra></extra>'
      : 'Giorno: %{x}<br>Utilizzo: %{y:.0f}<br>Livello di rischio: %{customdata:.1f}%<extra></extra>';
  
    const trace: Partial<Plotly.PlotData> = {
      x,
      y,
      customdata: risk,
      type: 'scatter',
      mode: 'markers',
      name: 'Presenze',
      marker: {
        color: colorValues,
        colorscale: colorScale || (input as any).colorScale, 
        cmin: 0,
        cmax: 1,
        size: 8,
        reversescale: true,
      },
      hovertemplate: hoverTemplate
    };
    const mapper = input.mapper || [];
    const foundLabel = mapper.find((m: any) => m.value === sottosistemaSelezionato);
    const titoloAsseY = foundLabel ? foundLabel.label : sottosistemaSelezionato;

    const layout: Partial<Plotly.Layout> = {
      ...DEFAULT_LAYOUT,
      xaxis: {
        title: { text: xAxisLabel },
        tickformat: '.0f'
      },
      yaxis: {
        title: {
          text:
          titoloAsseY === 'default' ?
              yAxisLabelDefault :
              'Livello di utilizzo della risorsa ' + titoloAsseY
        },
        range: [0, yAxisMax],
        tickformat: '.0f',
        layer: 'below traces'
      },
      margin: { t: 50, b: 80, l: 80, r: 60 },
      showlegend: true,
      legend: {
        orientation: 'h',
        yanchor: 'top',
        y: -0.2,
        xanchor: 'center',
        x: 0.5
      },
    };

    const capacityMean = sottosistemaSelezionato === 'default' ?
      input.capacity_mean :
      input.capacity_mean_by_constraint?.[sottosistemaSelezionato];
    const traceCapacityMean: Partial<Plotly.PlotData> = {
      x,
      y: Array(x.length).fill(capacityMean),
      type: 'scatter',
      mode: 'lines',
      name: this.getCapacityLabel(sottosistemaSelezionato),
      line: { color: PLOT_COLORS.capacityMean, dash: 'dash', width: 2 },
      yaxis: 'y1',
      showlegend: true,
    };
    const traces: Partial<Plotly.PlotData>[] = [
      traceCapacityMean
    ];

    traces.push(trace);
    this.renderPlot(container, traces, layout);
  }
  getCapacityLabel(subsystem: string): string {
    return subsystem === 'default' ? 'Soglia di sovraffollamento' : 'Capacità di carico';
  }
  async renderPlot(container: HTMLElement, data: any[], layout = DEFAULT_LAYOUT) {
    try {
      const plot = await Plotly.newPlot(container, data, layout, { responsive: true });
      this.disableLegendInteraction(plot);
    } catch (e) {
      console.error('Errore nel rendering Plotly:', e);
    }
  }
  private disableLegendInteraction(container: any) {
    container.on?.('plotly_legendclick', () => false);
    container.on?.('plotly_legenddoubleclick', () => false);
  }
  private getDefaultHoverTemplate(plotMapper?: any): string {
    const xLabel = this.getBiLabel(plotMapper, 'x', 'Turisti');
    const yLabel = this.getBiLabel(plotMapper, 'y', 'Escursionisti');
    return '<b>Livello di rischio:</b> %{customdata:.4f}%<br>' +
      `<b>${xLabel}:</b> %{x}<br>` +
      `<b>${yLabel}:</b> %{y}<br>` +
      '<extra></extra>';
  }
  private getUncertaintyData(sottosistema: string, points: any): any[] {
    if (!points) return [];
    return sottosistema === 'default'
      ? (Array.isArray(points['uncertainty']) ? points['uncertainty'] : [])
      : (points['uncertainty_by_constraint']?.[sottosistema] ?? []);
  }
  private createUncertaintyPoint(
    name: string,
    data: any[],
    showScale: boolean = false,
    colorScale?: any,
    plotMapper?: any // 🔴 nuovo parametro
  ): Point {
    return {
      name,
      x: data.map(p => p.tourists),
      y: data.map(p => p.excursionists),
      customdata: data.map(p => 100 * (1 - p.usage_uncertainty)),
      marker: {
        color: data.map(p => p.index),
        colorscale: colorScale,
        reversescale: true,
        cmin: 0,
        cmax: 1,
        size: 6,
        showscale: showScale,
      },
      mode: 'markers',
      type: 'scatter',
      hovertemplate: this.getDefaultHoverTemplate(plotMapper), // 🔴 label dinamiche
      showlegend: false
    };
  }


  /**
   * Extract structured summaries from PlotInput for chatbot
   */
    extractChartSummaries(
    input: PlotInput,
    scenario: 'left' | 'right',
    uiState: { monoDimensionale: boolean; sottosistemaSelezionato: string }
  ): ChartSummary[] {

    if (!input.curves || input.curves.length === 0) return [];

    // Group curves by subsystem if needed
    // Here we simply filter by selected subsystem or keep all
    const curves = uiState.sottosistemaSelezionato === 'default'
      ? input.curves
      : input.curves.filter(c => c.name.includes(uiState.sottosistemaSelezionato));

    // Optionally: group by function/subsystem
    // For simplicity, one ChartSummary per curve
    return curves.map<ChartSummary>(curve => {
      const x = curve.x;
      const y = curve.y;

      if (!y || y.length === 0) return {
        title: curve.name,
        subsystem: uiState.sottosistemaSelezionato,
        dimension: uiState.monoDimensionale ? 'mono' : 'bi',
        series: []
      };

      const min = Math.min(...y);
      const max = Math.max(...y);
      const avg = y.reduce((a, b) => a + b, 0) / y.length;

      // Determine trend: compare first vs last point
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      const delta = y[y.length - 1] - y[0];
      if (delta > 1e-5) trend = 'increasing';
      else if (delta < -1e-5) trend = 'decreasing';

      const seriesSummary: ChartSeriesSummary = {
        scenario,
        name: curve.name,
        min: +min.toFixed(2),
        max: +max.toFixed(2),
        avg: +avg.toFixed(2),
        trend
      };

      return {
        title: curve.name,
        subsystem: uiState.sottosistemaSelezionato,
        dimension: uiState.monoDimensionale ? 'mono' : 'bi',
        series: [seriesSummary]
      };
    });
  }

}

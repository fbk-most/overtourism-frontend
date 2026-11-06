import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PlotInput, SharedChartPayload } from '../../models/plot.model';
import { ReportWidgetPayload } from '../../models/report.model';
import { PlotService } from '../../services/plot.service';
import { ReportRenderService } from '../../services/report-render.service';
import { ScenarioService } from '../../services/scenario.service';

@Component({
  selector: 'app-report-plot',
  template: `
    <app-shared-plot
      *ngIf="payload"
      [payload]="payload"
      (renderComplete)="finishRendering()">
    </app-shared-plot>
    <p *ngIf="error" class="text-danger">{{ error }}</p>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-height: 420px;
      break-inside: avoid;
    }

    app-shared-plot {
      display: block;
      width: 100%;
      height: 420px;
    }
  `],
  standalone: false
})
export class ReportPlotComponent implements OnChanges {
  @Input() widget!: ReportWidgetPayload;
  @Input() scenarioTitle = '';

  payload: SharedChartPayload | null = null;
  error: string | null = null;
  private requestVersion = 0;
  private finishPendingPlot?: () => void;

  constructor(
    private plotService: PlotService,
    private scenarioService: ScenarioService,
    private reportRender: ReportRenderService
  ) { }

  ngOnChanges(_changes: SimpleChanges): void {
    this.finishRendering();
    this.finishPendingPlot = this.reportRender.beginPlot();
    void this.preparePlot();
  }

  finishRendering(): void {
    this.finishPendingPlot?.();
    this.finishPendingPlot = undefined;
  }

  private async preparePlot(): Promise<void> {
    const requestVersion = ++this.requestVersion;
    this.payload = null;
    this.error = null;

    try {
      const widgetData = this.asRecord(this.widget?.data);
      const data = this.asRecord(widgetData['payload'] ?? widgetData);

      if (this.isSharedChartPayload(data)) {
        this.payload = {
          ...data,
          type: this.plotType(data['type']),
          title: this.plotTitle(data, data['title'])
        };
        return;
      }

      const scenarioIds = Array.isArray(data['scenarioIds'])
        ? data['scenarioIds'].filter((id): id is string => typeof id === 'string')
        : [];
      const labels = this.asRecord(data['labels']);
      const title = this.plotTitle(data, scenarioIds[0] ? labels[scenarioIds[0]] : undefined);
      const scenarioData = this.scenarioData(data['data'], scenarioIds[0]);
      const plotData = this.asRecord(
        scenarioData['plot_data'] ?? scenarioData['data'] ?? scenarioData
      );

      if (this.isPreparedPlotInput(plotData)) {
        if (requestVersion !== this.requestVersion) return;
        this.payload = {
          type: this.plotType(data['type']),
          subsystem: typeof data['subsystem'] === 'string' ? data['subsystem'] : 'default',
          data: plotData,
          title
        };
        return;
      }

      if (Object.keys(plotData).length === 0) {
        throw new Error('Dati del grafico non disponibili.');
      }

      const configuration = await firstValueFrom(this.scenarioService.getParsedConfiguration());
      const input: PlotInput = this.plotService.preparePlotInput(
        plotData,
        configuration.colorMap,
        configuration.sottosistemi,
        configuration.plotMapper
      );

      if (requestVersion !== this.requestVersion) return;

      this.payload = {
        type: this.plotType(data['type']),
        subsystem: typeof data['subsystem'] === 'string' ? data['subsystem'] : 'default',
        data: input,
        title
      };
    } catch (error) {
      if (requestVersion !== this.requestVersion) return;
      this.error = error instanceof Error ? error.message : 'Errore durante il caricamento del grafico.';
      this.finishRendering();
    }
  }

  private scenarioData(rawData: unknown, scenarioId?: string): Record<string, unknown> {
    const data = this.asRecord(rawData);
    if (!scenarioId) return data;

    if (data[scenarioId] && typeof data[scenarioId] === 'object') {
      return this.asRecord(data[scenarioId]);
    }

    const matchingKey = Object.keys(data).find(key => key.includes(scenarioId));
    return matchingKey ? this.asRecord(data[matchingKey]) : data;
  }

  private isSharedChartPayload(
    data: Record<string, unknown>
  ): data is Record<string, unknown> & SharedChartPayload {
    return (data['type'] === 'mono' || data['type'] === 'bi')
      && typeof data['subsystem'] === 'string'
      && !!data['data']
      && typeof data['data'] === 'object';
  }

  private isPreparedPlotInput(data: Record<string, unknown>): data is Record<string, unknown> & PlotInput {
    return Array.isArray(data['curves']) && Array.isArray(data['points']);
  }

  private plotType(fallback: unknown): 'mono' | 'bi' {
    if (this.widget?.widgetName === 'loadPlot') return 'mono';
    if (this.widget?.widgetName === 'capacityPlot') return 'bi';
    return fallback === 'mono' ? 'mono' : 'bi';
  }

  private plotTitle(data: Record<string, unknown>, fallback: unknown): string {
    if (typeof data['title'] === 'string' && data['title'].trim()) return data['title'];
    if (this.scenarioTitle.trim()) return this.scenarioTitle;
    return typeof fallback === 'string' ? fallback : '';
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object'
      ? value as Record<string, unknown>
      : {};
  }
}

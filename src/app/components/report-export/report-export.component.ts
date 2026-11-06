import { Component, Input } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom, timer } from 'rxjs';
import { NotificationService } from '../../services/notifications.service';
import { ReportService } from '../../services/report.service';
import { ReportDocument, ReportWidgetPayload } from '../../models/report.model';
import { SharedHistogramPayload } from '../../models/plot.model';
import { CHAT_WIDGET_REGISTRY } from '../chatbot/chat-widget-registry';
import { ReportRenderService } from '../../services/report-render.service';

@Component({
  selector: 'app-report-export',
  templateUrl: './report-export.component.html',
  styleUrls: ['./report-export.component.scss'],
  standalone: false
})
export class ReportExportComponent {
  @Input() context: Record<string, string[]> = {};
  report: ReportDocument | null = null;
  isGenerating = false;
  readonly widgetRegistry = CHAT_WIDGET_REGISTRY;
  private readonly widgetInputCache = new WeakMap<ReportWidgetPayload, Record<string, unknown>>();

  constructor(
    private reportService: ReportService,
    private notifications: NotificationService,
    private reportRender: ReportRenderService,
    private translate: TranslateService
  ) { }

  async generateReport(): Promise<void> {
    if (this.isGenerating) return;

    this.isGenerating = true;
    this.report = null;
    const context = Object.fromEntries(
      Object.entries(this.context).filter(([, ids]) => ids.length > 0)
    );

    try {
      const userLang = this.translate.currentLang?.toLowerCase().startsWith('en')
        ? 'English'
        : 'Italian';
      this.report = await firstValueFrom(this.reportService.generate(context, userLang));
      if (this.report.warnings?.length) {
        this.notifications.showWarning(this.report.warnings.join(' '), 8000);
      }

      await firstValueFrom(timer(500));
      await this.reportRender.waitForPlots();
      window.print();
    } catch (error) {
      this.notifications.showError(this.getErrorMessage(error));
    } finally {
      this.isGenerating = false;
    }
  }

  paragraphs(text?: string): string[] {
    return text?.split('\n\n').map(paragraph => paragraph.trim()).filter(Boolean) ?? [];
  }

  widgetComponent(widgetName: string) {
    return this.widgetRegistry[widgetName] ?? null;
  }

  isPlotWidget(widgetName: string): boolean {
    return widgetName === 'loadPlot' || widgetName === 'capacityPlot';
  }

  widgetInputs(widget: ReportWidgetPayload): Record<string, unknown> {
    const cachedInputs = this.widgetInputCache.get(widget);
    if (cachedInputs) return cachedInputs;

    const data = widget.data !== null && typeof widget.data === 'object'
      ? widget.data as Record<string, unknown>
      : {};

    let inputs: Record<string, unknown>;
    if (widget.widgetName === 'histogramComparison') {
      inputs = this.histogramComparisonInputs(data);
    } else if (widget.widgetName === 'indexComparison') {
      const payload = this.asRecord(data['payload'] ?? data);
      const scenarioIds = this.scenarioIds(payload);
      inputs = {
        kpisMain: this.scenarioKpis(payload, scenarioIds[0]),
        kpisCompare: this.scenarioKpis(payload, scenarioIds[1])
      };
    } else {
      inputs = data;
    }

    this.widgetInputCache.set(widget, inputs);
    return inputs;
  }

  private histogramComparisonInputs(data: Record<string, unknown>): Record<string, unknown> {
    const payload = this.asRecord(data['payload'] ?? data);

    if (this.isSharedHistogramPayload(payload)) {
      return { payload, loading: false };
    }

    const scenarioIds = this.scenarioIds(payload);
    const labels = this.asRecord(payload['labels']);
    const chartPayload: SharedHistogramPayload = {
      labelLeft: this.scenarioLabel(labels, scenarioIds[0], 'Scenario 1'),
      labelRight: this.scenarioLabel(labels, scenarioIds[1], 'Scenario 2'),
      dataLeft: this.histogramKpis(this.scenarioKpis(payload, scenarioIds[0])),
      dataRight: this.histogramKpis(this.scenarioKpis(payload, scenarioIds[1]))
    };

    return { payload: chartPayload, loading: false };
  }

  private isSharedHistogramPayload(payload: Record<string, unknown>): payload is Record<string, unknown> & SharedHistogramPayload {
    return typeof payload['labelLeft'] === 'string'
      && typeof payload['labelRight'] === 'string'
      && payload['dataLeft'] !== null
      && typeof payload['dataLeft'] === 'object'
      && payload['dataRight'] !== null
      && typeof payload['dataRight'] === 'object';
  }

  private scenarioIds(payload: Record<string, unknown>): string[] {
    return Array.isArray(payload['scenarioIds'])
      ? payload['scenarioIds'].filter((id): id is string => typeof id === 'string')
      : [];
  }

  private scenarioLabel(labels: Record<string, unknown>, scenarioId: string | undefined, fallback: string): string {
    const label = scenarioId ? labels[scenarioId] : undefined;
    return typeof label === 'string' ? label : fallback;
  }

  private histogramKpis(kpis: Record<string, unknown>): SharedHistogramPayload['dataLeft'] {
    const systemKeys = new Set([
      'critical constraint',
      'critical_constraint',
      'uncertainty',
      'uncertainty_by_constraint',
      'area',
      'title'
    ]);

    return Object.fromEntries(
      Object.entries(kpis)
        .filter(([key]) => !systemKeys.has(key))
        .map(([key, value]) => {
          const entry = this.asRecord(value);
          return [key, {
            level: typeof entry['level'] === 'number' ? entry['level'] : 0,
            confidence: typeof entry['confidence'] === 'number' ? entry['confidence'] : 0
          }];
        })
    );
  }

  private scenarioKpis(payload: Record<string, unknown>, scenarioId?: string): Record<string, unknown> {
    if (!scenarioId) return {};

    const data = this.asRecord(payload['data']);
    const matchingKey = Object.keys(data).find(key => key === `scenarios ${scenarioId}`)
      ?? Object.keys(data).find(key => key.includes(scenarioId));
    const scenario = matchingKey ? this.asRecord(data[matchingKey]) : {};
    const plotData = this.asRecord(scenario['plot_data']);
    const kpis = scenario['data'] ?? plotData['kpis'];

    return this.asRecord(kpis);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object'
      ? value as Record<string, unknown>
      : {};
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const detail = error.error?.detail;
      if (typeof detail === 'string' && detail.trim()) return detail;
      return error.message || `Errore durante la generazione del report (HTTP ${error.status}).`;
    }
    return error instanceof Error ? error.message : 'Errore durante la generazione del report.';
  }
}

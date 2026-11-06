import { Component, Input } from '@angular/core';
import { CHAT_WIDGET_REGISTRY } from '../chatbot/chat-widget-registry';
import { ReportNode, ReportWidgetPayload } from '../../models/report.model';

@Component({
  selector: 'app-report-node',
  templateUrl: './report-node.component.html',
  standalone: false
})
export class ReportNodeComponent {
  @Input() node!: ReportNode;
  @Input() depth = 1;

  readonly widgetRegistry = CHAT_WIDGET_REGISTRY;

  get headingKey(): string {
    return `report.types.${this.node.type}`;
  }

  get children(): ReportNode[] {
    return this.node.children ?? [];
  }

  widgetComponent(widgetName: string) {
    return this.widgetRegistry[widgetName] ?? null;
  }

  isPlotWidget(widgetName: string): boolean {
    return widgetName === 'loadPlot' || widgetName === 'capacityPlot';
  }

  widgetInputs(widget: ReportWidgetPayload): Record<string, unknown> {
    return widget.data !== null && typeof widget.data === 'object'
      ? widget.data as Record<string, unknown>
      : {};
  }

  paragraphs(text?: string): string[] {
    return text?.split('\n\n').map(paragraph => paragraph.trim()).filter(Boolean) ?? [];
  }

}

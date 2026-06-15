import { KPIs } from './plot.model';
import { Widget } from '../services/scenario.service';
import { ChartSummary } from '../models/chart-summary.model';

export interface ConfrontoScenariContext {
  scenarios: {
    left: ScenarioContext;
    right: ScenarioContext;
  };
  comparisons: {
    widgetDiffs: {
      index_id: string;
      index_name: string;
      left: any;
      right: any;
    }[];
  };
  uiState: {
    monoDimensionale: boolean;
    sottosistemaSelezionato: string;
    showAllSubsystems: boolean;
  };
}

export interface ScenarioContext {
  id: string;
  name: string;
  color: string;
  kpis: KPIs;
  widgets: Widget[];
  charts: ChartSummary[];
}

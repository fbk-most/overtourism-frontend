export interface ReportResponse {
  report: ReportDocument;
}

export interface ReportDocument {
  report_type: 'territory' | 'problem' | 'proposal' | 'scenarios';
  title: string;
  territory: string;
  territory_label: string;
  generated_at: string;
  base_scenario: ReportScenarioNode | null;
  sections: ReportNode[];
  unassigned_scenarios: ReportScenarioNode[];
  warnings: string[];
  introduction?: string;
  conclusion?: string;
  comparisons?: ReportWidgetPayload[];
  plots_unavailable?: Array<{
    scenario_id?: string;
    scenario_ids?: string[];
    plot: string;
  }>;
}

export interface ReportNodeBase {
  id: string;
  title: string;
  narrative: string;
  is_base_scenario?: boolean;
  plots?: ReportWidgetPayload[];
  children?: ReportNode[];
}

export interface ReportProblemNode extends ReportNodeBase {
  type: 'problem';
  children: ReportProposalNode[];
}

export interface ReportProposalNode extends ReportNodeBase {
  type: 'proposal';
  children: ReportScenarioNode[];
}

export interface ReportScenarioNode extends ReportNodeBase {
  type: 'scenario';
  is_base_scenario: boolean;
}

export type ReportNode = ReportProblemNode | ReportProposalNode | ReportScenarioNode;

export interface ReportWidgetPayload {
  widgetName: string;
  data: unknown;
}

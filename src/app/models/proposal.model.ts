export interface ProposalScenario {
  scenario_id: string;
  scenario_name: string;
}

export interface ProposalExtras {
  impact?: string;
  context?: string;
  resources?: string[];
  [key: string]: any;
}

export interface Proposal {
  proposal_id: string;
  problem_id: string;
  version?: number;
  name: string | null;
  description: string | null;
  status: string;
  created?: string | null;
  updated?: string | null;
  extras?: ProposalExtras;
  related_scenario_ids: string[];
}
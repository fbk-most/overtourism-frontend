export interface ScenarioIndexValue {
  index_id?: string;
  value?: number | [number, number];
  [key: string]: any;
}

export interface ProblemScenario {
  id: string;  
  scenario_id: string;
  problem_id: string;
  version?: number;
  name: string | null;
  description?: string | null;
  summary?: string | null;
  created?: string | null;
  updated?: string | null;
  extras?: any;
  index_values?: ScenarioIndexValue[]; 
}
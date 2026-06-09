export interface ProblemExtras {
  editable_indexes?: string[];
  groups?: string[];
  objective?: string;
  links?: string[];
  [key: string]: any;
}

export interface Problem {
  problem_id: string;
  version?: number;
  tenant?: string;
  name: string;
  description: string;
  updated?: Date;
  created?: Date;
  extras?: ProblemExtras;
}
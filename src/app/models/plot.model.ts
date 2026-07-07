// src/app/plot.model.ts

import { ScatterMarker, ColorScale, PlotType } from "plotly.js-dist-min";
import { DataFact } from "./data-fact.model";


export interface SharedChartPayload {
  type: 'mono' | 'bi';               
  subsystem: string;                 
  data: PlotInput;                   
  themeOverrides?: any;             
}

export type Curve = {
  x: number[];
  y: number[];
  name: string;
  color?: string;
  dash?: 'solid' | 'dot' | 'dash' | 'dashdot';
};

export type Heatmap = {
  x: number[];
  y: number[];
  z: number[][];
};

export interface Point {
  name: string;
  x: number[];
  y: number[];
  color?: string | string[];
  marker?: any;
  customdata?: any[];
  hovertemplate?: string;
  mode?: any;
  type?: any;
  showlegend?: boolean;
}


export interface CriticalConstraint {
  name: string;
  level: number;
}

export interface KPIs {
  [key: string]: any;
}

export interface PlotInput {
  curves: Curve[];
  heatmap?: { x: number[]; y: number[]; z: number[][] };
  xMax?: number;
  yMax?: number;
  points: Point[];
  heatmapsByFunction?: Record<string, number[][]>;
  usage?: number[];
  sample_t?: number[];
  sample_e?: number[];
  capacity?: number[][];
  capacity_mean?: number;
  kpis?: KPIs;
  usage_by_constraint?: Record<string, number[]>;
  capacity_by_constraint?: Record<string, number[][]>;
  capacity_mean_by_constraint?: Record<string, number>;
  editable_indexes?: string[];
  dataFacts?: DataFact[];
}

export interface HistogramComparisonPayload {
  dataLeft: Record<string, { level: number; confidence: number }>;
  dataRight: Record<string, { level: number; confidence: number }>;
  labelLeft: string;
  labelRight: string;
}




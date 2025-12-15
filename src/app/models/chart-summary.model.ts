export interface ChartSummary {
  title: string;
  subsystem: string;
  dimension: 'mono' | 'bi';
  series: ChartSeriesSummary[];
}

export interface ChartSeriesSummary {
  scenario: 'left' | 'right';
  name: string;
  min: number;
  max: number;
  avg: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

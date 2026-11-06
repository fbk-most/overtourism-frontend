import { getComparisonChartKpis } from './kpi.utils';

describe('getComparisonChartKpis', () => {
  it('excludes system and value/share KPIs while preserving chart indicators', () => {
    const result = getComparisonChartKpis({
      sustainability_level: { level: 42, confidence: 1.2 },
      'critical constraint': { name: 'parking', level: 20 },
      uncertainty_by_constraint: { level: 4 },
      area: { level: 100 },
      visitors: { value: 120, share: 0.4 }
    });

    expect(Object.keys(result)).toEqual(['sustainability_level']);
  });

  it('excludes system KPI keys regardless of spaces and capitalization', () => {
    const result = getComparisonChartKpis({
      ' Critical_Constraint ': { level: 1 },
      UNCERTAINTY: { level: 1 },
      'Uncertainty By Constraint': { level: 1 },
      title: { level: 1 },
      constraint_level_parcheggi: { level: 20 }
    });

    expect(Object.keys(result)).toEqual(['constraint_level_parcheggi']);
  });
});

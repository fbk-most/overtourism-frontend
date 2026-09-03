export function stripSystemKpis(kpis: Record<string, any> = {}): Record<string, any> {
    const excluded = ['critical constraint', 'critical_constraint', 'uncertainty', 'uncertainty_by_constraint'];
    const clean = { ...kpis };
    excluded.forEach(k => delete clean[k]);
    return clean;
  }
  
  export function getKpiLabel(key: string, kpiMapper: Record<string, string> = {}): string {
    const mappedKeySpace = key.replace(/_/g, ' ');
    const mappedKeyTrim = key.replace('constraint_level_', 'constraint level ');
    return kpiMapper[key] || kpiMapper[mappedKeyTrim] || kpiMapper[mappedKeySpace] || key;
  }
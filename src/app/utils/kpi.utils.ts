const SYSTEM_KPI_KEYS = new Set([
  'critical constraint',
  'uncertainty',
  'uncertainty by constraint',
  'area',
  'title'
]);

export function stripSystemKpis(kpis: Record<string, any> = {}): Record<string, any> {
  return Object.fromEntries(
    Object.entries(kpis).filter(([key]) => !SYSTEM_KPI_KEYS.has(normalizeKpiKey(key)))
  );
}

export function normalizeKpiKey(key: string): string {
  return key
    .toLowerCase()
    .trim()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}

export function isValueShareKpi(value: unknown): value is { value: number; share: number } {
  if (typeof value !== 'object' || value === null) return false;
  const kpi = value as Record<string, unknown>;
  return typeof kpi['value'] === 'number' && typeof kpi['share'] === 'number';
}

export function getComparisonChartKpis(kpis: Record<string, unknown> = {}): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(stripSystemKpis(kpis)).filter(([, value]) =>
      !isValueShareKpi(value)
    )
  );
}

export function getKpiLabel(key: string, kpiMapper: Record<string, string> = {}): string {
  if (!kpiMapper) return key;

  if (kpiMapper[key]) return kpiMapper[key];

  const normalizedKey = normalizeKpiKey(key);
  const foundKey = Object.keys(kpiMapper).find(k => normalizeKpiKey(k) === normalizedKey);

  if (foundKey) {
    return kpiMapper[foundKey];
  }

  return key;
}

export function isPercentageKpi(key: string): boolean {
  const norm = normalizeKpiKey(key);
  if (norm.includes('dropout')) {
    return false;
  }
  return true;
}
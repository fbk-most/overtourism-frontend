import { TemporalGranularity, VariationSeries } from './indici.model';

export interface SharedTimeSeriesPayload {
  labels: string[];
  series: VariationSeries[];
  title?: string;
  unitDescription?: string;
  granularity?: TemporalGranularity;
  selectedItems?: string[]; 
  codeToName?: Record<string, string> | Map<string, string>;
}
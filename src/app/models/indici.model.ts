export interface IndicatorMeta {
    value: string;
    label: string;
    index_description?: string; 
    index_value_unit_description?: string;
    availableForVariation: boolean;
    extraFields: string[];
    years_range: { min_year: number; max_year: number };
  }
  
  export interface Comune {
    code: string;
    name: string;
  }
  
  export type ShowOption = 'map' | 'chart' ;
  export type TemporalGranularity = 'annuale' | 'mensile' | 'giornaliero';
  
  export interface GeoDataEnvelope {
    data: string;        
    min_value: number;
    max_value: number;
  }
  
  export interface IndexDataResponse {
    geo_data: GeoDataEnvelope;
  }
  
  export interface VariationSeries {
    label: string;
    data: number[];
    std?: number[];
  }
  
  export interface VariationDataResponse {
    labels: string[];
    series: VariationSeries[];
  }
  
  export interface VariationOverTimeResponse {
    geo_data: GeoDataEnvelope;
  }
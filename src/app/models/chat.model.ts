import { SharedChartPayload } from "./plot.model";

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    chartData?: SharedChartPayload | null; 
    slidersData?: SlidersData | null;
  }
  
  export interface SlidersData {
    widgets: Record<string, SliderWidget[]>;
  }
  
  export interface SliderWidget {
    index_id: string;
    index_name: string;
    index_type: string;
    index_category: string;
    min: number;
    max: number;
    step: number;
    loc?: number;
    v?: number;
    scale?: number;
    editable: boolean;
    _val: number;
    _initial: number;
  }
  
  export interface ChatFeedback {
    vote?: 'up' | 'down' | null;
    comment?: string;
  }
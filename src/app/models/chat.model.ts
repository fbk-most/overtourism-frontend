import { SharedChartPayload } from "./plot.model";

// ─── Domain Events  ───────────────────────────
// da definire bene
export type DomainEventType =
  | 'SCENARIO_CREATED'
  | 'SCENARIO_UPDATED'
  | 'COMPARISON_READY'
  | 'EVALUATION_READY'
  | 'NAVIGATION_REQUESTED';  //??

export interface DomainEvent {
  type: DomainEventType;
  payload: Record<string, any>;
}

// ─── UI Actions ────────────────────────────────
export type UIActionType = 'NAVIGATE' | 'SHOW_WIDGET' | 'SHOW_TOAST';

export interface UIAction {
  type: UIActionType;
  payload: Record<string, any>;
}

// ─── Risposta strutturata dal backend ─────────────────────────────────────
export interface AgentResponse {
  response: string;
  session_id?: string;
  active_context?: string;
  chart_data?: SharedChartPayload | null;
  sliders_data?: SlidersData | null;
  events?: DomainEvent[];  
}

// ─── Messaggio in chat ─────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;                          // testo raw
  html?: string;                            // testo pre-renderizzato markdown (opzionale)
  index?: number;                           // per il feedback keying
  chartData?: SharedChartPayload | null;
  slidersData?: SlidersData | null;
  inlineActions?: UIAction[];
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
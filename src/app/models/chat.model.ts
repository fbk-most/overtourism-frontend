import { SharedChartPayload } from "./plot.model";

// ─── Domain Events  ───────────────────────────
// da definire bene
export type DomainEventType =
 | 'SHOW_WIDGET'
 | 'DELETED'
 | 'COMPARE_SCENARIO'
 | 'NAVIGATE'

  // // da definire bene
  // | 'SCENARIO_CREATED'
  // | 'SCENARIO_UPDATED'
  // | 'COMPARISON_READY'
  // | 'EVALUATION_READY'
  // | 'NAVIGATION_REQUESTED';  //??
  export type AgentType = 'executor' | 'operative' | 'methodological' | 'exploitative';

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
  agent_type?: AgentType;
  session_id?: string;
  active_context?: string;
  chart_data?: SharedChartPayload | null;
  assistant_action_data?: DomainEvent[]; 
}

// ─── Messaggio in chat ─────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;                          // testo raw
  agentType?: AgentType;
  html?: string;                            // testo pre-renderizzato markdown (opzionale)
  index?: number;                           // per il feedback keying
  chartData?: SharedChartPayload | null;
  inlineActions?: UIAction[];
}

export interface ChatFeedback {
  vote?: 'up' | 'down' | null;
  comment?: string;
}
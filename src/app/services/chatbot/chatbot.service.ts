import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChatMessage } from '../../models/chat.model';

export interface ChatRequest {
  messages: ChatMessage[];
}

export interface ChatResponse {
  reply: string;
}

/** Modalità del chatbot: ognuna ha la propria cronologia e la propria sessione in cache. */
export type ChatStorageMode = 'standalone' | 'integrated';

export const CHAT_SESSION_UNAVAILABLE_MESSAGE =
  'La conversazione non può essere recuperata. Per favore inizia una nuova conversazione';

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private baseUrl: string;

  // Cronologia messaggi: una chiave per modalità, così le due chat non si sovrascrivono.
  private readonly MESSAGES_KEYS: Record<ChatStorageMode, string> = {
    standalone: 'chatbot_messages',
    integrated: 'integrated_chatbot_messages'
  };
  // Devono coincidere con le chiavi usate da AgentService per il session_id.
  private readonly SESSION_KEYS: Record<ChatStorageMode, string> = {
    standalone: 'chatbot_session_id',
    integrated: 'integrated_chatbot_session_id'
  };
  private readonly MODES: ChatStorageMode[] = ['standalone', 'integrated'];

  constructor(private http: HttpClient) {
    this.baseUrl = environment.apiBaseUrl;
  }

  /** Cancella cronologia e sessione di TUTTE le chat (login, logout, cambio territorio). */
  clearSession(): void {
    this.MODES.forEach(mode => {
      this.clearMessages(mode);
      localStorage.removeItem(this.SESSION_KEYS[mode]);
    });
    localStorage.removeItem('chatbot_force_role');
  }

  /** Cancella solo la cronologia dei messaggi della modalità indicata. */
  clearMessages(mode: ChatStorageMode = 'standalone'): void {
    localStorage.removeItem(this.MESSAGES_KEYS[mode]);
  }

  // Salva i messaggi nel localStorage ogni volta che cambiano
  // In questo modo i messaggi non vengono persi se si chiude il browser
  // o si riavvia il sistema
  saveMessages(msgs: ChatMessage[], mode: ChatStorageMode = 'standalone'): void {
    const key = this.MESSAGES_KEYS[mode];
    try {
      const msgsToSave = msgs.map(m => ({ ...m }));

      let stringified = JSON.stringify(msgsToSave);

      while (stringified.length > 4000000 && msgsToSave.length > 1) {
        msgsToSave.shift();
        stringified = JSON.stringify(msgsToSave);
      }

      localStorage.setItem(key, stringified);
    } catch (error) {
      console.error('Impossibile salvare la cronologia della chat in localStorage (Quota superata):', error);
      localStorage.removeItem(key);
    }
  }

  loadMessages(mode: ChatStorageMode = 'standalone'): ChatMessage[] {
    try {
      const saved = localStorage.getItem(this.MESSAGES_KEYS[mode]);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  sendConversation(messages: ChatMessage[]): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.baseUrl}/llm`, { messages });
  }
}

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

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private baseUrl: string;
  private readonly STORAGE_KEY = 'chatbot_messages';
  private readonly SESSION_KEY = 'chatbot_session_id';

  constructor(private http: HttpClient) {
    this.baseUrl = environment.apiBaseUrl;
  }

  clearSession(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.SESSION_KEY);
  }

  // Salva i messaggi nel localStorage ogni volta che cambiano
  // In questo modo i messaggi non vengono persi se si chiude il browser
  // o si riavvia il sistema
  // E' importante che i messaggi vengano salvati in modo asincrono
  // perche' la funzione saveMessages puo' essere chiamata piu' volte
  // contemporaneamente
  saveMessages(msgs: ChatMessage[]): void {
    try {
      // Creiamo una copia leggera della cronologia rimuovendo l'enorme mole di dati dei grafici
      const lightMsgs = msgs.map(m => {
        const lightMsg: any = { role: m.role, content: m.content };
        
        if (m.inlineActions && m.inlineActions.length > 0) {
          lightMsg.inlineActions = m.inlineActions.map(action => {
            if (action.type === 'SHOW_WIDGET') {
              return {
                ...action,
                payload: {
                  widgetName: action.payload['widgetName'],
                  data: null 
                }
              };
            }
            return action;
          });
        }
        return lightMsg as ChatMessage;
      });

      let stringified = JSON.stringify(lightMsgs);

      while (stringified.length > 4000000 && lightMsgs.length > 1) {
        lightMsgs.shift();
        stringified = JSON.stringify(lightMsgs);
      }

      localStorage.setItem(this.STORAGE_KEY, stringified);
    } catch (error) {
      console.error('Impossibile salvare la cronologia della chat in localStorage (Quota superata):', error);
      localStorage.removeItem(this.STORAGE_KEY); 
    }
  }

  loadMessages(): ChatMessage[] {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  loadSessionId(): string | null {
    return localStorage.getItem(this.SESSION_KEY);
  }

  saveSessionId(id: string): void {
    localStorage.setItem(this.SESSION_KEY, id);
  }

  sendConversation(messages: ChatMessage[]): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.baseUrl}/llm`, { messages });
  }
}
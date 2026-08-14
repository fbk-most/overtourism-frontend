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

  saveMessages(msgs: ChatMessage[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(msgs));
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
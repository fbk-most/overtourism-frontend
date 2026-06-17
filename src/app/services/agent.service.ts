import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AgentService {
  private readonly apiUrl = environment.agentApiUrl;

  constructor(private http: HttpClient) {}

  sendMessage(sessionId: string, message: string, language: string, files: File[]): Observable<any> {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('session_id', sessionId);
    formData.append('user_lang', language);
    files.forEach(file => formData.append('files', file));
    return this.http.post(this.apiUrl, formData, { withCredentials: true });
  }

  getResult(sessionId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/result/${sessionId}`, { withCredentials: true });
  }

  injectSliders(sessionId: string, values: Record<string, any>): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/inject_sliders`,
      { session_id: sessionId, values },
      { withCredentials: true }
    );
  }

  submitFeedback(sessionId: string, messageIndex: number, vote?: string | null, comment?: string): Observable<any> {
    const params: any = { session_id: sessionId, message_index: String(messageIndex) };
    if (vote) params['vote'] = vote;
    if (comment) params['comment'] = comment;
    return this.http.get(`${this.apiUrl}/feedback`, { params, withCredentials: true });
  }

  saveConversation(sessionId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/save/${sessionId}`, { withCredentials: true });
  }

  createEventSource(sessionId: string): EventSource {
    return new EventSource(`${this.apiUrl}/stream/${sessionId}`, { withCredentials: true });
  }

  generateSessionId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 8 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
  }
}
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthenticationService } from './authentication.service';
import { fetchEventSource } from '@microsoft/fetch-event-source';

@Injectable({ providedIn: 'root' })
export class AgentService {
  private readonly apiUrl = environment.agentApiUrl;

  constructor(private http: HttpClient, private authService: AuthenticationService) { }

  sendMessage(
    sessionId: string, 
    message: string, 
    language: string, 
    files: File[] = [], 
    integratedMode: boolean = false,  
    context: string[] = []            
  ): Observable<any> {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('session_id', sessionId);
    formData.append('user_lang', language);
    
    formData.append('integrated_mode', integratedMode ? 'true' : 'false');
    
    files.forEach(file => formData.append('files', file));
    
    context.forEach(ctx => formData.append('context', ctx));

    return this.http.post(this.apiUrl, formData, { withCredentials: true });
  }

  getResult(sessionId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/result/${sessionId}`, { withCredentials: true });
  }

  getSummary(scenarioIds: string[], sessionId?: string, evaluationId?: string): Observable<any> {
    const body: any = sessionId && evaluationId
      ? {
        key: 'summary-temp',
        scenario_ids: scenarioIds,
        creation_session: sessionId,
        evaluation_id: evaluationId
      }
      : { key: 'summary', scenario_ids: scenarioIds };

    return this.http.post(`${this.apiUrl}/tool`, body, { withCredentials: true });
  }

  getUsageStats(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/usage_stats`, { withCredentials: true });
  }

  injectSliders(sessionId: string, values: Record<string, any>): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/inject_sliders`,
      { session_id: sessionId, values },
      { withCredentials: true }
    );
  }

  submitFeedback(sessionId: string, messageIndex: number, vote?: string | null, comment?: string): Observable<any> {
    const params: any = { session_id: sessionId, message_index: messageIndex };
    if (vote) params['vote'] = vote;
    if (comment) params['comment'] = comment;
    return this.http.post(`${this.apiUrl}/feedback`, null, { params, withCredentials: true });
  }

  createEventSource(sessionId: string): any {
    const params = new URLSearchParams();
    if (this.authService.activeTenant) {
      params.append('tenant', this.authService.activeTenant);
    }

    const qs = params.toString();
    const url = `${this.apiUrl}/stream/${sessionId}${qs ? '?' + qs : ''}`;
    const ctrl = new AbortController();
    const token = this.authService.accessToken;

    const listeners: Record<string, Array<(e: any) => void>> = {};

    const customEventSource = {
      addEventListener: (type: string, handler: (e: any) => void) => {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(handler);
      },
      onmessage: null as ((ev: any) => void) | null,
      onerror: null as ((err: any) => void) | null,
      close: () => ctrl.abort()
    };

    fetchEventSource(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream'
      },
      signal: ctrl.signal,
      onmessage(msg) {
        const eventType = msg.event || 'message';

        let resolvedType = eventType;
        let payload: any = { data: msg.data };
        try {
          const parsed = JSON.parse(msg.data);
          if (parsed?.type) {
            resolvedType = parsed.type;
            payload = { data: parsed.content ?? msg.data, raw: parsed };
          }
        } catch { }

        if (listeners[resolvedType]) {
          listeners[resolvedType].forEach(fn => fn(payload));
        }
        if (customEventSource.onmessage) {
          customEventSource.onmessage({ data: msg.data, type: resolvedType });
        }
      },
      onerror(err) {
        if (customEventSource.onerror) {
          customEventSource.onerror(err);
        }
        throw err;
      }
    });

    return customEventSource;
  }

  generateSessionId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 8 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
  }
}
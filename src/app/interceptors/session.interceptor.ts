import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable()
export class SessionInterceptor implements HttpInterceptor {
  private readonly SESSION_KEY = 'session_info';
  private readonly EXPIRATION_DAYS = 7;

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const apiBaseUrl = environment.apiBaseUrl;
    const isTargetEndpoint = req.url.startsWith(apiBaseUrl) && /\/scenarios\/[^\/]+$/.test(req.url);
    const isAllowedMethod = ['GET', 'PUT', 'POST'].includes(req.method);

    if (isTargetEndpoint && isAllowedMethod) {
      const sessionId = this.getOrCreateValidSessionId();
      const clonedReq = req.clone({
        setParams: {
          ...req.params.keys().reduce((acc, key) => {
            acc[key] = req.params.get(key) || '';
            return acc;
          }, {} as Record<string, string>),
          session_id: sessionId
        }
      });
      return next.handle(clonedReq);
    }

    return next.handle(req);
  }

  private getOrCreateValidSessionId(): string {
    const stored = localStorage.getItem(this.SESSION_KEY);
    const now = Date.now();

    if (stored) {
      try {
        const { sessionId, timestamp } = JSON.parse(stored);
        const expired = now - timestamp > this.EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
        if (!expired) {
          return sessionId;
        }
      } catch {
        // Fall-through to regenerate
      }
    }

    const newSessionId = this.generateSessionId();
    const sessionData = {
      sessionId: newSessionId,
      timestamp: now
    };
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
    return newSessionId;
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 10) +
           Math.random().toString(36).substring(2, 10);
  }
}

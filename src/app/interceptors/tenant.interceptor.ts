import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthenticationService } from '../services/authentication.service';
import { environment } from '../../environments/environment';

@Injectable()
export class TenantInterceptor implements HttpInterceptor {
  constructor(private authService: AuthenticationService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (req.url.includes('/default/tenants')) {
      return next.handle(req);
    }
    const activeTenant = this.authService.activeTenant;
    if (!activeTenant) {
      return next.handle(req);
    }

    const apiBase = environment.apiBaseUrl;
    const agentApi = environment.agentApiUrl;

    // API classica: tenant nel PATH
    if (req.url.startsWith(apiBase)) {
      const newUrl = req.url.replace(apiBase, `${apiBase}/${activeTenant}`);
      return next.handle(req.clone({ url: newUrl }));
    }

    // Agent API: tenant come QUERY PARAMETER
    if (req.url.startsWith(agentApi)) {
      const separator = req.url.includes('?') ? '&' : '?';
      const newUrl = `${req.url}${separator}tenant=${activeTenant}`;
      return next.handle(req.clone({ url: newUrl }));
    }

    return next.handle(req);
  }
}
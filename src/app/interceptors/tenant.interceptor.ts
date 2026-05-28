import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthenticationService } from '../services/authentication.service';
import { environment } from '../../environments/environment';

@Injectable()
export class TenantInterceptor implements HttpInterceptor {
  constructor(private authService: AuthenticationService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const apiBase = environment.apiBaseUrl;

    if (req.url.startsWith(apiBase)) {
      const activeTenant = this.authService.activeTenant;
      
      if (activeTenant) {
        const newUrl = req.url.replace(apiBase, `${apiBase}/${activeTenant}`);
        const clonedReq = req.clone({ url: newUrl });
        return next.handle(clonedReq);
      }
    }

    return next.handle(req);
  }
}
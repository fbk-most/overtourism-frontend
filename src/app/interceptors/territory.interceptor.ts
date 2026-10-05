import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthenticationService } from '../services/authentication.service';
import { environment } from '../../environments/environment';

@Injectable()
export class TerritoryInterceptor implements HttpInterceptor {

  private readonly excludedPatterns = [
    '/auth/',
    '/default/territories',
    '/assets/'
  ];

  constructor(private authService: AuthenticationService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const isApiUrl = request.url.startsWith(environment.apiBaseUrl);

    // Salta se non è una chiamata alle nostre API o se matcha una rotta esclusa
    const isExcluded = this.excludedPatterns.some(pattern => request.url.includes(pattern));

    if (!isApiUrl || isExcluded) {
      return next.handle(request);
    }

    const territory = this.authService.activeTerritory;

    if (territory) {
      // Sostituisce apiBaseUrl con apiBaseUrl + '/' + territory se non è già presente
      const targetPrefix = `${environment.apiBaseUrl}/${territory}`;
      
      if (!request.url.startsWith(targetPrefix)) {
        const pathAfterBase = request.url.substring(environment.apiBaseUrl.length);
        const newUrl = `${environment.apiBaseUrl}/${territory}${pathAfterBase}`;
        const modifiedRequest = request.clone({ url: newUrl });
        return next.handle(modifiedRequest);
      }
    }

    return next.handle(request);
  }
}
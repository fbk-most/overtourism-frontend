import { Injectable } from '@angular/core';
import {
  HttpInterceptor, HttpRequest, HttpHandler,
  HttpEvent, HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthenticationService } from '../services/authentication.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private authService: AuthenticationService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          console.warn('HTTP 401: sessione scaduta o non valida. Logout.');
          this.authService.forceLocalLogout();
        } else if (error.status === 403) {
          console.warn('HTTP 403: utente non autorizzato. Redirect a login non autorizzato.');
          this.authService.handleUnauthorized();
        }
        return throwError(() => error);
      })
    );
  }
}
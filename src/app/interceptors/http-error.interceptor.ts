import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { NotificationService } from '../services/notifications.service';
import { AuthenticationService } from '../services/authentication.service';

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {
  constructor(
    private notificationService: NotificationService,
    private authService: AuthenticationService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      timeout(60000),
      catchError((error: any) => {
        let message = 'Errore imprevisto.';

        if (error instanceof TimeoutError) {
          message = 'Timeout della richiesta al server.';
          this.notificationService.showError(message);
        } else if (error instanceof HttpErrorResponse) {
          switch (error.status) {
            case 0:
              message = 'Il server non è raggiungibile.';
              this.notificationService.showError(message);
              break;
            case 401:
              message = 'Sessione scaduta o non autorizzata. Effettua nuovamente il login.';
              this.authService.logout();
              break;
            case 403:
              // Gestito da AuthInterceptor / AuthenticationService (redirect a login con unauthorized)
              break;
            case 404:
              message = 'Risorsa non trovata.';
              this.notificationService.showError(message);
              break;
            case 500:
              message = 'Errore interno del server.';
              this.notificationService.showError(message);
              break;
            default:
              message = error.error?.message || error.message || 'Errore generico.';
              this.notificationService.showError(message);
          }
        }

        // RILANCIA L'ERRORE ORIGINALE (mantiene .status, .headers, .error)
        return throwError(() => error);
      })
    );
  }
}
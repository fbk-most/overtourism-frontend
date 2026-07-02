import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { NotificationService } from '../services/notifications.service';
import { AuthenticationService } from '../services/authentication.service'; // AGGIUNTO

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {
  constructor(private notificationService: NotificationService,
    private authService: AuthenticationService

  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      timeout(20000),
      catchError((error: any) => {
        let message = 'Errore imprevisto.';

        if (error instanceof TimeoutError) {
          message = 'Timeout della richiesta al server.';
        } else if (error instanceof HttpErrorResponse) {
          switch (error.status) {
            case 0:
              message = 'Il server non è raggiungibile.';
              break;
           case 401:
                message = 'Sessione scaduta o non autorizzata. Effettua nuovamente il login.';
                // this.authService.logout();
                break;
            case 404:
              message = 'Risorsa non trovata.';
              break;
            case 500:
              message = 'Errore interno del server.';
              break;
            default:
              message = error.error?.message || error.message || 'Errore generico.';
          }
        }

        this.notificationService.showError(message);
        return throwError(() => new Error(message));
      })
    );
  }
}

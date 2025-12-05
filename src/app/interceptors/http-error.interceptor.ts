import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { NotificationService } from '../services/notifications.service';

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {
  constructor(private notificationService: NotificationService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      timeout(10000000), //TODO RESTORE ORIGINAL VALUE 10000
      catchError((error: any) => {
        let message = 'Errore imprevisto.';

        if (error instanceof TimeoutError) {
          message = 'Timeout della richiesta al server.';
        } else if (error instanceof HttpErrorResponse) {
          switch (error.status) {
            case 0:
              message = 'Il server non è raggiungibile.';
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

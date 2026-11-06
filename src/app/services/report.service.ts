import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable, timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthenticationService } from './authentication.service';
import { ReportDocument, ReportResponse } from '../models/report.model';

@Injectable({ providedIn: 'root' })
export class ReportService {
  constructor(
    private http: HttpClient,
    private authService: AuthenticationService
  ) { }

  generate(
    currentContext: Record<string, string[]> = {},
    userLang: 'Italian' | 'English' = 'Italian'
  ): Observable<ReportDocument> {
    let params = new HttpParams();
    const territory = this.authService.activeTerritory;
    if (territory) params = params.set('territory', territory);

    return this.http.post<ReportResponse>(
      `${environment.agentApiUrl}/tool`,
      { key: 'pdf-report', current_context: currentContext, user_lang: userLang },
      { params, withCredentials: true }
    ).pipe(
      map(response => {
        if (!response?.report) {
          throw new Error('The report service returned an empty report.');
        }
        return response.report;
      }),
      timeout(120_000)
    );
  }
}

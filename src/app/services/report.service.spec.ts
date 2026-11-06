import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { AuthenticationService } from './authentication.service';
import { ReportService } from './report.service';
import { environment } from '../../environments/environment';
import { ReportDocument } from '../models/report.model';
import { firstValueFrom } from 'rxjs';

describe('ReportService', () => {
  let service: ReportService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ReportService,
        {
          provide: AuthenticationService,
          useValue: { activeTerritory: 'test-territory' }
        }
      ]
    });
    service = TestBed.inject(ReportService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests a PDF report for the active territory and selected context', async () => {
    const report: ReportDocument = {
      report_type: 'scenarios',
      title: 'Scenario report',
      territory: 'test-territory',
      territory_label: 'Test territory',
      generated_at: '2026-11-06T08:00:00Z',
      base_scenario: null,
      sections: [],
      unassigned_scenarios: [],
      warnings: []
    };
    const result = firstValueFrom(
      service.generate({ scenarios: ['scenario-1', 'scenario-2'] }, 'English')
    );
    const request = http.expectOne(
      req => req.url === `${environment.agentApiUrl}/tool`
        && req.params.get('territory') === 'test-territory'
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.body).toEqual({
      key: 'pdf-report',
      current_context: { scenarios: ['scenario-1', 'scenario-2'] },
      user_lang: 'English'
    });
    request.flush({ report });

    await expectAsync(result).toBeResolvedTo(report);
  });
});

import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { IndiciComponent } from './indici.component';
import { IndiciService } from '../../services/indici.service';

describe('IndiciComponent page context', () => {
  let component: IndiciComponent;
  let fixture: ComponentFixture<IndiciComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [IndiciComponent],
      imports: [CommonModule],
      providers: [{
        provide: IndiciService,
        useValue: {
          getIndicatorList: () => of({ indicators: [], additional_labels: [] }),
          getSpatialAreas: () => of({ comuni: [], areas: [] })
        }
      }],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(IndiciComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('exposes selected index filters and territories without chart data', () => {
    component.filterState = {
      indicator: 'tourism-index',
      spatialGranularity: 'comune',
      startDate: '2023-01-01',
      endDate: '2023-12-31',
      granularity: 'annuale',
      enableVariation: false,
      showOption: 'chart'
    };
    component.selectedComuni = ['m1'];
    component.codeToName.set('m1', 'Molveno');
    component.chartSeries = [{ label: 'Molveno', data: [1, 2] }];
    fixture.detectChanges();

    const page = fixture.nativeElement.querySelector(
      '[data-assistant-index-id="tourism-index"]'
    ) as HTMLElement;
    const chart = fixture.nativeElement.querySelector(
      '[data-assistant-chart]'
    ) as HTMLElement;

    expect(page.getAttribute('data-assistant-start-date')).toBe('2023-01-01');
    expect(page.getAttribute('data-assistant-end-date')).toBe('2023-12-31');
    expect(page.getAttribute('data-assistant-granularity')).toBe('annuale');
    expect(page.getAttribute('data-assistant-selected-territories')).toBe('["Molveno"]');
    expect(chart.getAttribute('data-assistant-chart-index-id')).toBe('tourism-index');
    expect(chart.getAttribute('data-assistant-chart-start-date')).toBe('2023-01-01');
    expect(chart.getAttribute('data-assistant-chart-end-date')).toBe('2023-12-31');
    expect(chart.getAttribute('data-assistant-chart-granularity')).toBe('annuale');
  });
});

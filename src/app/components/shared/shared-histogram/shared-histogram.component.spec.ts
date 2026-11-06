import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import Plotly from 'plotly.js-dist-min';

import { SharedHistogramComponent } from './shared-histogram.component';

describe('SharedHistogramComponent', () => {
  let component: SharedHistogramComponent;
  let fixture: ComponentFixture<SharedHistogramComponent>;
  let translate: jasmine.SpyObj<TranslateService>;

  beforeEach(async () => {
    translate = jasmine.createSpyObj<TranslateService>('TranslateService', ['instant']);
    translate.instant.and.callFake(key => key);

    await TestBed.configureTestingModule({
      declarations: [SharedHistogramComponent],
      providers: [{
        provide: TranslateService,
        useValue: translate
      }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SharedHistogramComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('filters comparison-only KPIs and translates the bar labels', () => {
    translate.instant.and.callFake(key =>
      key === 'kpi.sustainability_level' ? 'Sustainable' : key
    );
    const plotSpy = spyOn(Plotly, 'newPlot');
    fixture.componentRef.setInput('payload', {
      labelLeft: 'Scenario 1',
      labelRight: 'Scenario 2',
      dataLeft: {
        sustainability_level: { level: 50, confidence: 1 },
        uncertainty: { level: 5, confidence: 1 },
        visitors: { value: 100, share: 0.5 }
      },
      dataRight: {
        sustainability_level: { level: 60, confidence: 1 },
        critical_constraint: { level: 3, confidence: 0 }
      }
    });

    fixture.detectChanges();

    const traces = plotSpy.calls.mostRecent().args[1];
    expect(traces[0]).toEqual(jasmine.objectContaining({ x: ['Sustainable<br>'] }));
  });
});

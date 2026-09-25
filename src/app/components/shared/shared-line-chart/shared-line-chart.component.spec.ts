import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SharedLineChartComponent } from './shared-line-chart.component';

describe('SharedHistogramComponent', () => {
  let component: SharedLineChartComponent;
  let fixture: ComponentFixture<SharedLineChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SharedLineChartComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SharedLineChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

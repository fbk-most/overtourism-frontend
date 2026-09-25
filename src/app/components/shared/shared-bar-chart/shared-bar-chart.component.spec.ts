import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SharedBarChartComponent } from './shared-bar-chart.component';

describe('SharedHistogramComponent', () => {
  let component: SharedBarChartComponent;
  let fixture: ComponentFixture<SharedBarChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SharedBarChartComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SharedBarChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

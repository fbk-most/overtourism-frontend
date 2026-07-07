import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistogramComparisonComponent } from './histogram-comparison.component';

describe('HistogramComparisonComponent', () => {
  let component: HistogramComparisonComponent;
  let fixture: ComponentFixture<HistogramComparisonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HistogramComparisonComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistogramComparisonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

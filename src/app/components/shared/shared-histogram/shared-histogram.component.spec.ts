import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SharedHistogramComponent } from './shared-histogram.component';

describe('SharedHistogramComponent', () => {
  let component: SharedHistogramComponent;
  let fixture: ComponentFixture<SharedHistogramComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SharedHistogramComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SharedHistogramComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

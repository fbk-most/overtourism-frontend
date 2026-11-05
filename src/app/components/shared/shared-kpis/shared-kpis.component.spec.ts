import { DecimalPipe } from '@angular/common';
import { SharedKpisComponent } from './shared-kpis.component';

describe('SharedKpisComponent', () => {
  let component: SharedKpisComponent;

  beforeEach(() => {
    component = new SharedKpisComponent(new DecimalPipe('en-US'));
  });

  it('formats value/share KPIs as a whole value and percentage share', () => {
    expect(component.getDisplayValue('arrivals mean', { value: 535.5, share: 100 }))
      .toBe('535 (100%)');
  });

  it('formats excursionist KPIs as counts with their percentage share', () => {
    expect(component.getDisplayValue('excursionists mean', { value: 2715, share: 98.28 }))
      .toBe('2,715 (98%)');
    expect(component.getDisplayValue('excursionists_peak', { value: 5673.3, share: 91.92 }))
      .toBe('5,673 (92%)');
  });

  it('treats excursionist deltas as counts rather than percentages', () => {
    expect(component.getDeltaPerc('excursionists_mean', { value: 100, share: 10 }, { value: 125, share: 12 }))
      .toBe('+25');
  });

  it('retains percentage formatting for level KPIs', () => {
    expect(component.getDisplayValue('sustainability_level', { level: 94.4654 }))
      .toBe('94.5%');
  });
});

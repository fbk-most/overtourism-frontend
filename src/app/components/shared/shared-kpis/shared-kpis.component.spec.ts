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

  it('formats any value/share KPI as a count with its percentage share', () => {
    expect(component.getDisplayValue('excursionists mean', { value: 2715, share: 98.28 }))
      .toBe('2,715 (98%)');
    expect(component.getDisplayValue('arrivals_peak', { value: 1361.3, share: 91.1 }))
      .toBe('1,361 (91%)');
    expect(component.getDisplayValue('vehicles mean', { value: 28.3, share: 19.76 }))
      .toBe('28 (20%)');
  });

  it('treats value/share KPI deltas as counts rather than percentages', () => {
    expect(component.getDeltaPerc('vehicles_peak', { value: 50, share: 10 }, { value: 75, share: 12 }))
      .toBe('+25');
  });

  it('retains percentage formatting for level KPIs', () => {
    expect(component.getDisplayValue('sustainability_level', { level: 94.4654 }))
      .toBe('94.5%');
  });
});

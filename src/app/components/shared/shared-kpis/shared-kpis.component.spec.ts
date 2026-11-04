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

  it('retains percentage formatting for level KPIs', () => {
    expect(component.getDisplayValue('sustainability_level', { level: 94.4654 }))
      .toBe('94.5%');
  });
});

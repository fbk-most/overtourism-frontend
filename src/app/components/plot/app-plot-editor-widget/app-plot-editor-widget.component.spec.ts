import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NO_ERRORS_SCHEMA, Pipe, PipeTransform } from '@angular/core';
import { of } from 'rxjs';
import { ScenarioService } from '../../../services/scenario.service';

import { AppPlotEditorWidgetComponent } from './app-plot-editor-widget.component';

@Pipe({ name: 'translate', standalone: false })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('AppPlotEditorWidgetComponent', () => {
  let component: AppPlotEditorWidgetComponent;
  let fixture: ComponentFixture<AppPlotEditorWidgetComponent>;
  const scenarioService = {
    currentScenario$: of(null),
    fetchScenarioData: jasmine.createSpy('fetchScenarioData')
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AppPlotEditorWidgetComponent, MockTranslatePipe],
      imports: [CommonModule, FormsModule, ReactiveFormsModule],
      providers: [{ provide: ScenarioService, useValue: scenarioService }],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppPlotEditorWidgetComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('exposes parameter names and the selected tab in the rendered controls', () => {
    component.widgets = {
      Parcheggi: [{
        name: 'parking_capacity',
        label: 'Posti auto',
        kind: 'scalar',
        default: 2.5
      }]
    };
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector(
      'input[data-assistant-param-name="parking_capacity"]'
    ) as HTMLInputElement;

    expect(input).not.toBeNull();
    expect(input.getAttribute('aria-label')).toBe('Posti auto');
    expect(fixture.nativeElement.querySelector('[data-assistant-active-tab]')?.getAttribute(
      'data-assistant-active-tab'
    )).toBe('Parcheggi');
  });
});

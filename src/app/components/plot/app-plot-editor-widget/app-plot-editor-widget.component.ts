import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ScenarioService, Widget } from '../../../services/scenario.service';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { OnInit, OnDestroy } from '@angular/core';
import { takeUntil } from 'rxjs/operators';
@Component({
  selector: 'app-plot-editor-widget',
  standalone: false,
  templateUrl: './app-plot-editor-widget.component.html',
  styleUrls: ['./app-plot-editor-widget.component.scss']
})
export class AppPlotEditorWidgetComponent implements OnInit, OnDestroy {
  @Input() set widgets(value: Record<string, Widget[]>) {
    this._widgets = JSON.parse(JSON.stringify(value));
  }
  @Input() editableIndexes: string[] = [];

  private widgetChange$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  get widgets(): Record<string, Widget[]> {
    return this._widgets;
  }
  private _widgets: Record<string, Widget[]> = {};
  
    @Output() widgetsChanged = new EventEmitter<Record<string, Widget[]>>();
    onWidgetChange() {
      this.widgetChange$.next();
    }
  objectKeys = Object.keys;

  scenario: any;
  rangeValue = 50;
  formGroup: FormGroup;
  constructor(private readonly formBuilder: FormBuilder,private scenarioService: ScenarioService) {
    this.formGroup = this.formBuilder.group({
      range: [null],
    });
  }
  // constructor(private scenarioService: ScenarioService) {}
  activeTab: string = '';

  ngOnInit(): void {
    this.scenarioService.currentScenario$.subscribe(scenario => {
      if (scenario) this.scenario = scenario;
    });

    for (const group of this.objectKeys(this.widgets)) {
      for (const widget of this.widgets[group]) {
        if (widget.kind === 'distribution') {
          // Range doppio: legge default_range oppure min/max
          widget.vMin = widget.vMin ?? (widget as any).default_range?.[0] ?? widget.min_value ?? 0;
          widget.vMax = widget.vMax ?? (widget as any).default_range?.[1] ?? widget.max_value ?? 100;
        } else if (widget.kind === 'scalar') {
          // Valore singolo: legge default oppure min_value
          widget.v = widget.v ?? (widget as any).default ?? widget.min_value ?? 0;
        } else if (widget.kind === 'categorical') {
          // Select: legge default_category oppure primo support
          widget.v = widget.v ?? (widget as any).default_category ?? (widget as any).support?.[0];
        }
      }
    }

    this.scenarioService.fetchScenarioData();
    const groups = this.objectKeys(this.widgets);
    if (groups.length) this.activeTab = groups[0];

    this.widgetChange$
      .pipe(debounceTime(500), takeUntil(this.destroy$))
      .subscribe(() => {
        this.widgetsChanged.emit(JSON.parse(JSON.stringify(this._widgets)));
      });
  }
  // selectCategorical(widget: Widget, value: string): void {
  //   widget.v = value; 
  //   this.onWidgetChange();
  // }
  isEditable(widget: Widget): boolean {
    // return true
    return this.editableIndexes.includes(widget.name); 
  }
  increase(widget: Widget): void {
    const step = widget.step || 1;
    const max = widget.max_value ?? Infinity;
    widget.v = Math.min(Number(widget.v ?? 0) + step, max);
    this.onWidgetChange(); 
  }
  openDropdown: Record<string, boolean> = {};

  toggleDropdown(widgetName: string): void {
    this.openDropdown[widgetName] = !this.openDropdown[widgetName];
  }

  closeDropdown(widgetName: string): void {
    this.openDropdown[widgetName] = false;
  }

  selectCategorical(widget: Widget, value: string): void {
    widget.v = value;
    this.closeDropdown(widget.name);
    this.onWidgetChange();
  }
  
  decrease(widget: Widget): void {
    const step = widget.step || 1;
    const min = widget.min_value ?? -Infinity;
    widget.v = Math.max(Number(widget.v ?? 0) - step, min);
    this.onWidgetChange(); 
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatSliderWidgetComponent } from '../chat-slider-widget/chat-slider-widget.component';
import { SlidersData, SliderWidget } from '../../../models/chat.model';
import { AgentService } from '../../../services/agent.service';

@Component({
  selector: 'app-chat-sliders-panel',
  standalone: true,
  imports: [CommonModule, ChatSliderWidgetComponent],
  template: `
    <div class="sliders-panel">
      <div class="sliders-layout">
        <div class="tab-list">
          <button *ngFor="let g of groups" [class.active]="activeTab === g"
            class="tab-btn" (click)="activeTab = g">{{ g }}</button>
        </div>
        <div class="sliders-grid">
          <app-chat-slider-widget *ngFor="let w of editableWidgets" [widget]="w"
            (valueChange)="onValueChange(activeTab, w.index_id, $event)">
          </app-chat-slider-widget>
        </div>
      </div>
      <div class="sliders-footer">
        <button class="submit-sliders-btn" (click)="handleSubmit()" [disabled]="submitting">
          {{ submitting ? 'Indici modificati' : 'Conferma modifica' }}
        </button>
      </div>
    </div>
  `
})
export class ChatSlidersPanelComponent implements OnInit {
  @Input() slidersData!: SlidersData;
  @Input() sessionId!: string;
  @Output() sliderSubmit = new EventEmitter<string>();

  groups: string[] = [];
  activeTab = '';
  state: Record<string, SliderWidget[]> = {};
  submitting = false;

  get editableWidgets(): SliderWidget[] {
    return (this.state[this.activeTab] || []).filter(w => w.editable);
  }

  constructor(private agentSvc: AgentService) {}

  ngOnInit() {
    this.groups = Object.keys(this.slidersData.widgets);
    this.activeTab = this.groups[0] || '';
    this.initState();
  }

  initState() {
    this.state = {};
    for (const group of this.groups) {
      this.state[group] = this.slidersData.widgets[group].map(w => {
        const initial = w.index_type === 'uniform' ? (w.loc ?? 0) : (w.v ?? w.loc ?? 0);
        return { ...w, _val: initial, _initial: initial };
      });
    }
  }

  onValueChange(group: string, indexId: string, newVal: number) {
    this.state[group] = this.state[group].map(w =>
      w.index_id === indexId ? { ...w, _val: newVal } : w
    );
  }

  handleSubmit() {
    if (this.submitting) return;
    const allWidgets = Object.values(this.state).flat();
    const payload: Record<string, any> = {};
    allWidgets.filter(w => w._val !== w._initial).forEach(w => {
      payload[w.index_id] = w.scale != null ? [w._val, w._val + w.scale] : w._val;
    });
    if (!Object.keys(payload).length) return;

    this.submitting = true;
    this.agentSvc.injectSliders(this.sessionId, payload).subscribe({
      next: () => this.sliderSubmit.emit(this.sessionId),
      error: () => { this.submitting = false; }
    });
  }
}
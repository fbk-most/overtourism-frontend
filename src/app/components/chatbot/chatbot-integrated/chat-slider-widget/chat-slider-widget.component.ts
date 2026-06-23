import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SliderWidget } from '../../../../models/chat.model';

@Component({
  selector: 'app-chat-slider-widget',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="slider-card">
      <div class="slider-label">{{ widget.index_name }}</div>
      <div class="slider-row">
        <input type="range" [min]="widget.min" [max]="widget.max" [step]="widget.step || 1"
          [value]="widget._val" (input)="onInput($event)" />
        <span class="slider-value">{{ fmtVal(widget._val) }}{{ suffix }}</span>
      </div>
      <div class="stepper-row">
        <button class="step-btn" (click)="step(-1)">−</button>
        <button class="step-btn" (click)="step(1)">+</button>
        <span *ngIf="isUniform" class="slider-badge">distribuzione uniforme</span>
      </div>
    </div>
  `
})
export class ChatSliderWidgetComponent {
  @Input() widget!: SliderWidget;
  @Output() valueChange = new EventEmitter<number>();

  get suffix() { return this.widget.index_category === '%' ? '%' : ''; }
  get isUniform() { return this.widget.index_type === 'uniform' && this.widget.index_category !== '%'; }

  fmtVal(v: number): string { return parseFloat(v.toFixed(4)).toString(); }

  onInput(event: Event) {
    this.valueChange.emit(parseFloat((event.target as HTMLInputElement).value));
  }

  step(dir: number) {
    const s = this.widget.step || 1;
    const next = Math.round((this.widget._val + dir * s) * 1e6) / 1e6;
    this.valueChange.emit(Math.min(Math.max(next, this.widget.min), this.widget.max));
  }
}
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-plot-controls',
  standalone: false,
  templateUrl: './plot-controls.component.html',
  styleUrls: ['./plot-controls.component.scss']
})
export class PlotControlsComponent {
  @Input() monoDimensionale!: boolean;
  @Input() sottosistemi!: Array<{ value: string; label: string }>;
  @Input() sottosistemaSelezionato!: string;
  @Output() monoDimensionaleChange = new EventEmitter<boolean>();
  @Output() sottosistemaSelezionatoChange = new EventEmitter<string>();
  @Output() funzioneChange = new EventEmitter<void>();
  @Input() colorMap: any[] = [];
  setMonoDimensionale(val: boolean) {
    this.monoDimensionale = val;
    this.monoDimensionaleChange.emit(val);
    this.funzioneChange.emit();
  }
  get gradientStyle() {
    if (!this.colorMap || this.colorMap.length === 0) return '';
    const stops = this.colorMap.map(stop => `${stop[1]} ${stop[0] * 100}%`).join(', ');
    return `linear-gradient(to right, ${stops})`;
  }

  getColorAt(percentage: number): string {
    if (!this.colorMap || this.colorMap.length === 0) return 'gray';
    const exact = this.colorMap.find(c => c[0] === percentage);
    if (exact) return exact[1];
    
    let closest = this.colorMap[0];
    let minDiff = Math.abs(closest[0] - percentage);
    for (const c of this.colorMap) {
      const diff = Math.abs(c[0] - percentage);
      if (diff < minDiff) { 
        minDiff = diff; 
        closest = c; 
      }
    }
    return closest[1];
  }
}

import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, AfterViewInit } from '@angular/core';
import { PlotInput, SharedChartPayload } from '../../../models/plot.model';
import { PlotService } from '../../../services/plot.service';


@Component({
  selector: 'app-shared-plot',
  standalone: true,
  imports: [],
  templateUrl: './shared-plot.component.html',
})
export class SharedPlotComponent implements OnChanges, AfterViewInit {
  @Input() payload!: SharedChartPayload | null;
  @Input() loading: boolean = false;
  @Output() renderComplete = new EventEmitter<void>();

  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef<HTMLElement>;

  constructor(private plotService: PlotService) { }

  ngAfterViewInit() { void this.renderGraph(); }

  ngOnChanges() { void this.renderGraph(); }

  private async renderGraph(): Promise<void> {
    if (!this.chartContainer || !this.payload?.data) return;

    try {
      if (this.payload.type === 'mono') {
        await this.plotService.renderMonoDimensionale(
          this.payload.subsystem,
          this.chartContainer.nativeElement,
          this.payload.data,
          undefined,
          this.payload.title
        );
      } else {
        const cloned = JSON.parse(JSON.stringify(this.payload.data));
        await this.plotService.renderBidimensionale(
          this.payload.subsystem,
          this.chartContainer.nativeElement,
          cloned,
          undefined,
          this.payload.title
        );
      }
    } finally {
      this.renderComplete.emit();
    }
  }
}
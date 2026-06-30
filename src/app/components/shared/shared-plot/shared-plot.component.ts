import { Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild, AfterViewInit } from '@angular/core';
import { PlotInput, SharedChartPayload } from '../../../models/plot.model';
import { PlotService } from '../../../services/plot.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-shared-plot',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shared-plot.component.html',
})
export class SharedPlotComponent implements OnChanges, AfterViewInit {
  @Input() payload!: SharedChartPayload | null;
  @Input() loading: boolean = false;

  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef<HTMLElement>;

  constructor(private plotService: PlotService) { }

  ngAfterViewInit() { this.renderGraph(); }

  ngOnChanges() { this.renderGraph(); }

  private renderGraph() {
    if (!this.chartContainer || !this.payload?.data) return;

    if (this.payload.type === 'mono') {
      this.plotService.renderMonoDimensionale(
        this.payload.subsystem,
        this.chartContainer.nativeElement,
        this.payload.data
      );
    } else {
      const cloned = JSON.parse(JSON.stringify(this.payload.data));
      this.plotService.renderBidimensionale(
        this.payload.subsystem,
        this.chartContainer.nativeElement,
        cloned
      );
    }
  }
}
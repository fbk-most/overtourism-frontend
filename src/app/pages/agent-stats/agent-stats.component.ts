import { Component, OnInit, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { AgentService } from '../../services/agent.service';
import * as Plotly from 'plotly.js-dist-min';

@Component({
  selector: 'app-agent-stats',
  standalone: false,
  templateUrl: './agent-stats.component.html',
  styleUrls: ['./agent-stats.component.scss']
})
export class AgentStatsComponent implements OnInit {
  @ViewChild('chartCost',   { static: false }) chartCost!:   ElementRef;
  @ViewChild('chartTokens', { static: false }) chartTokens!: ElementRef;

  loading = true;
  error   = false;
  stats: any[] = [];
  users:  string[] = [];
  dates:  string[] = [];

  constructor(private agentService: AgentService,    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.agentService.getUsageStats().subscribe({
      next: (data) => {
        this.stats = data;
        this.users = [...new Set(data.map((d: any) => d.user_id))];
        this.dates = [...new Set(data.map((d: any) => d.date))].sort();
        this.loading = false;
        this.cdr.detectChanges(); 
        this.renderCharts();      },
      error: () => { this.loading = false; this.error = true; }
    });
  }

  get totals() {
    return {
      requests:      this.stats.reduce((s, d) => s + d.requests, 0),
      input_tokens:  this.stats.reduce((s, d) => s + d.input_tokens, 0),
      output_tokens: this.stats.reduce((s, d) => s + d.output_tokens, 0),
      cost:          this.stats.reduce((s, d) => s + d.total_cost_usd, 0).toFixed(4)
    };
  }

  private getValue(user: string, date: string, field: string): number {
    const row = this.stats.find(d => d.user_id === user && d.date === date);
    return row ? row[field] : 0;
  }

  private renderCharts(): void {
    // ── Grafico 1: Costo per utente (stack) ──────────────────────────────
    const costTraces = this.users.map(user => ({
      x: this.dates,
      y: this.dates.map(date => this.getValue(user, date, 'total_cost_usd')),
      name: user,
      type: 'bar' as const,
      hovertemplate: '<b>%{x}</b><br>%{fullData.name}: $%{y:.4f}<extra></extra>'
    }));

    Plotly.newPlot(this.chartCost.nativeElement, costTraces, {
      title: { text: 'Costo giornaliero per utente (USD)' },
      barmode: 'stack',
      xaxis: { title: { text: 'Data' }, type: 'category' },
      yaxis: { title: { text: 'USD' } },
      legend: { orientation: 'h', y: -0.25 },
      margin: { t: 50, b: 80, l: 60, r: 20 }
    } as any, { responsive: true });

    // ── Grafico 2: Token input + output per utente (stack) ────────────────
    const tokenTraces = this.users.map(user => ({
        x: this.dates,
        y: this.dates.map(date => 
          this.getValue(user, date, 'input_tokens') + this.getValue(user, date, 'output_tokens')
        ),
        name: user,
        type: 'bar' as const,
        hovertemplate: '<b>%{x}</b><br>%{fullData.name}: %{y:,} token<extra></extra>'
      }));
  
      Plotly.newPlot(this.chartTokens.nativeElement, tokenTraces, {
        title: { text: 'Token consumati per utente (input + output)' },
        barmode: 'stack',
        xaxis: { title: { text: 'Data' }, type: 'category' },
        yaxis: { title: { text: 'Token' } },
        legend: { orientation: 'h', y: -0.3 },
        margin: { t: 50, b: 100, l: 60, r: 20 }
      } as any, { responsive: true });
  }
}
import { Component, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PlotService } from '../../../services/plot.service';
import { ScenarioService } from '../../../services/scenario.service';
import { ProblemScenario } from '../../../models/scenario.model';
import { PlotComponent } from '../../../components/plot/plot.component';
import { ItModalComponent } from 'design-angular-kit';
import { PdfService } from '../../../services/pdf.service';

@Component({
  selector: 'app-scenario-detail',
  standalone: false,
  templateUrl: './scenario-detail.component.html',
  styleUrl: './scenario-detail.component.scss'
})
export class ScenarioDetailComponent {
  @ViewChild('plotContainer') plotContainer!: ElementRef<HTMLDivElement>;
  @ViewChild(PlotComponent) plotComponent!: PlotComponent;
  @ViewChild('deleteModal') deleteModal!: ItModalComponent;

  scenarioId!: string;
  problemId!: string;
  proposalId!: string;
  scenario?: ProblemScenario;
  isDownloading = false;

  constructor(
    private route: ActivatedRoute,
    private scenarioService: ScenarioService,
    private router: Router,
    private pdfService: PdfService


  ) { }

  ngOnInit(): void {
    this.problemId = this.route.snapshot.paramMap.get('problemId')!;
    this.proposalId = this.route.snapshot.paramMap.get('proposalId')!;
    this.scenarioId = this.route.snapshot.paramMap.get('scenarioId')!;
    this.loadScenarioDetails();
  }
  canDeactivate(): Promise<boolean> | boolean {
    // Se il plotComponent esiste, delega a lui
    return this.plotComponent?.canDeactivate() ?? true;
  }
  loadScenarioDetails(): void {
    this.scenarioService.getScenariosByProblemId(this.problemId).subscribe({
      next: (scenarios) => {
        this.scenario = scenarios.find(s => s.id === this.scenarioId);
      }
    });
  }
  openDeleteModal(): void {
    this.deleteModal.toggle();
  }

  onCancelDelete(): void {
    this.deleteModal.hide();
  }
  downloadPdf(): void {
    if (this.isDownloading) return; 
    this.isDownloading = true;
  
    setTimeout(async () => {
      try {
        await this.pdfService.downloadPdfFromElement(
          'pdfContent',
          `${this.scenario?.name || 'scenario'}.pdf`
        );
      } finally {
        this.isDownloading = false;
      }
    }, 0);
  }
  confirmDelete(): void {
    this.scenarioService.deleteScenario(this.scenarioId, this.problemId, this.proposalId).subscribe({
      next: () => {
        this.deleteModal.hide();
        // ✅ Naviga alla pagina della proposta
        this.router.navigate([
          '/problems',
          this.problemId,
          'proposals',
          this.proposalId
        ]);
      },
      error: (err) => {
        console.error('Errore durante la cancellazione dello scenario', err);
        this.deleteModal.hide();
        alert('Si è verificato un errore durante la cancellazione.');
      }
    });
  }

}

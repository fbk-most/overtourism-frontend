import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProblemService } from '../../../services/problem.service';
import { NotificationService } from '../../../services/notifications.service';
import { TranslateService } from '@ngx-translate/core';
import { Proposal } from '../../../models/proposal.model';
import { ProposalService } from '../../../services/proposal.service';
import { ItModalComponent } from 'design-angular-kit';
import { Problem } from '../../../models/problem.model';
import { ModalCleanupService } from '../../../services/modal-cleanup.service.ts.service';

interface ProposalResponse {
  data: Proposal[];
  message?: string;
}
@Component({
  selector: 'app-problem-detail',
  templateUrl: './problem-detail.component.html',
  standalone: false,
  styleUrls: ['./problem-detail.component.scss']
})
export class ProblemDetailComponent implements OnInit,AfterViewInit {

  problemId!: string;
  problem: Problem | null = null;
  proposals: Proposal[] = [];
  showProposalForm = false;

  @ViewChild('deleteProblemModal') deleteProblemModal!: ItModalComponent;
  @ViewChild('proposalModal') proposalModal!: ItModalComponent;
  @ViewChild('editProblemModal') editProblemModal!: ItModalComponent;
  @ViewChild('deleteProposalModal') deleteProposalModal: any;

  onProblemEdited(problem: Problem) {
    this.editProblemModal.hide();
    this.loadProblem();
  }
  onProblemEditCancelled() {
    this.editProblemModal.hide();
  }
  proposalToEdit?: Proposal;
  proposalToDelete: Proposal | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private problemService: ProblemService,
    private notif: NotificationService,
    private translate: TranslateService,
    private proposalService: ProposalService,
        private modalCleanup: ModalCleanupService
    
  ) {}

  ngOnInit() {
    this.problemId = this.route.snapshot.paramMap.get('problemId')!;
    this.loadProblem();
  }
  ngAfterViewInit(): void {
      if (this.deleteProblemModal) {
        this.modalCleanup.register(this.deleteProblemModal);
      }
      if (this.deleteProposalModal) {
        this.modalCleanup.register(this.deleteProposalModal);
      }
      if (this.proposalModal) {
        this.modalCleanup.register(this.proposalModal);
      }
      if (this.editProblemModal) {
        this.modalCleanup.register(this.editProblemModal);
      }
  }
  onProposalCreated() {
    this.showProposalForm = false;   
    this.loadProblem();             
  }
  // elimina proposta
  removeProposal(proposalId: string) {
    if (!this.problemId) return;
  
    this.proposalService.deleteProposal(proposalId, this.problemId).subscribe({
      next: () => {
        this.notif.showSuccess('Proposta eliminata con successo');
        // Aggiorna la lista senza ricaricare tutta la pagina
        this.proposals = this.proposals.filter(p => p.proposal_id !== proposalId);
      },
      error: (err) => {
        this.notif.showError(err?.message || 'Errore durante l\'eliminazione della proposta');
      }
    });
  }
  openProposalModal(): void {
    this.proposalToEdit = undefined;
    this.proposalModal.show();
  }
// modifica proposta 
editProposal(proposalId: string): void {
  const proposal = this.proposals.find(p => p.proposal_id === proposalId);
  if (proposal) {
    this.proposalToEdit = { ...proposal }; 
    this.proposalModal.show();
  }
}
onProposalCreatedModal(): void {
  this.proposalModal.hide();
  this.loadProblem(); // ricarica dati per aggiornare lista
}

onCancelProposal(): void {
  this.proposalModal.hide();
}
editProblem() {
  this.router.navigate(['/problems/create'], {
    queryParams: { edit: this.problemId }
  });
}

// Apri modal
openDeleteModal(event?: Event): void {
  if (event) event.stopPropagation();
  this.deleteProblemModal.toggle();
}
get modalTitle(): string {
  return this.proposalToEdit 
    ? this.translate.instant('proposals.edit_title') 
    : this.translate.instant('proposals.add_title');
}
// Annulla
onCancelDeleteProblem(): void {
  this.deleteProblemModal.hide();
}

// Conferma
onConfirmDeleteProblem(): void {
  if (!this.problemId) return;

  this.problemService.deleteProblem(this.problemId).subscribe({
    next: () => {
      this.notif.showSuccess(
        this.translate.instant('problems.delete_success', { name: this.problem?.name })
      );
      this.deleteProblemModal.hide();
      this.router.navigate(['/problems']);
    },
    error: (err) => {
      this.notif.showError(
        this.translate.instant('problems.delete_error', { name: this.problem?.name }) ||
        err?.message
      );
      this.deleteProblemModal.hide();
    }
  });
}

loadProposals() {
  if (!this.problemId) return;

  this.proposalService.getProposals(this.problemId).subscribe({
    next: (res: Proposal[]) => {
      this.proposals = res;
    },
    error: (err) => this.notif.showError(err.message || this.translate.instant('problems.load_error'))  });
}
loadProblem() {
  this.problemService.getProblemById(this.problemId).subscribe({
    next: (res) => {
      this.problem = res;
      this.loadProposals(); 
    },
    error: (err) => this.notif.showError(err?.message || this.translate.instant('problems.load_error'))
  });
}
viewProposalDetail(proposalId: any) {
  if (!this.problemId) return;
  this.router.navigate([`/problems/${this.problemId}/proposals/${proposalId}`]);
}
openDeleteProposalModal(proposal: any): void {
  this.proposalToDelete = proposal;
  this.deleteProposalModal.show();
}

onCancelDeleteProposal(): void {
  this.deleteProposalModal.hide();
  this.proposalToDelete = null;
}

onConfirmDeleteProposal(): void {
  if (!this.proposalToDelete || !this.problemId) return;

  const proposalId = this.proposalToDelete.proposal_id;

  this.proposalService.deleteProposal(proposalId, this.problemId).subscribe({
    next: () => {
      this.notif.showSuccess('Proposta eliminata con successo');
      this.proposals = this.proposals.filter(p => p.proposal_id !== proposalId);
      this.deleteProposalModal.hide();
      this.proposalToDelete = null;
    },
    error: (err) => {
      this.notif.showError(err?.message || 'Errore durante l\'eliminazione della proposta');
      this.deleteProposalModal.hide();
    }
  });
}

  toggleProposalForm() {
    this.showProposalForm = !this.showProposalForm;
  }

  back() {
    this.router.navigate(['/problems']);
  }
  onProblemCancel() {
    this.editProblemModal.hide();
  }
}

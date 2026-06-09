import { Component, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { Proposal } from '../../models/proposal.model';
import { ItModalComponent } from 'design-angular-kit';
import { ProblemScenario } from '../../models/scenario.model';

@Component({
  selector: 'app-proposal-detail',
  templateUrl: './proposal-detail.component.html',
  standalone: false,
  styleUrls: ['./proposal-detail.component.scss'],
})
export class ProposalDetailComponent {
  @Input() proposal!: Proposal;
  @Input() availableScenarios: ProblemScenario[] = []; 
  @Output() deleteProposal = new EventEmitter<string>();
  @Output() editProposal = new EventEmitter<string>();
  @ViewChild('deleteProposalModal') deleteProposalModal!: ItModalComponent;
  proposalToDeleteId: string | null = null;

  openDeleteModal(proposalId: string): void {
    this.proposalToDeleteId = proposalId;
    this.deleteProposalModal.show();
  }

  onCancelDeleteProposal(): void {
    this.proposalToDeleteId = null;
    this.deleteProposalModal.hide();
  }

  onConfirmDeleteProposal(): void {
    if (this.proposalToDeleteId) {
      this.deleteProposal.emit(this.proposalToDeleteId);
    }
    this.deleteProposalModal.hide();
    this.proposalToDeleteId = null;
  }
  // status potrebbe essere undefined, fallback a ''
  statusClass(status?: string): string {
    switch (status) {
      case 'draft': return 'bg-secondary text-white';
      case 'submitted': return 'bg-primary text-white';
      case 'approved': return 'bg-success text-white';
      case 'rejected': return 'bg-danger text-white';
      default: return 'bg-light text-dark';
    }
  }

  getScenarioName(id: string): string {
    if (!this.availableScenarios) return id;
    const found = this.availableScenarios.find(s => s.id === id);
    return found && found.name ? found.name : id;
  }
}

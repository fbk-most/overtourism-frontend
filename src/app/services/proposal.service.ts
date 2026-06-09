import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { map, Observable } from 'rxjs';
import { Proposal } from '../models/proposal.model';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class ProposalService {
  private baseUrl: string;

  constructor(private http: HttpClient, private configService: ConfigService) {
    this.baseUrl = environment.apiBaseUrl;
  }
getProposal(proposalId: string, problemId: string): Observable<Proposal> {
  return this.http.get<Proposal>(`${this.baseUrl}/proposals/${proposalId}`, {
    params: { problem_id: problemId }
  });
}
getProposals(problemId: string): Observable<Proposal[]> {
  return this.http.get<Proposal[]>(`${this.baseUrl}/proposals`, {
    params: { problem_id: problemId }
  });
}
  createProposal(problemId: string, payload: Proposal) {
    return this.http.post(`${this.baseUrl}/proposals?problem_id=${problemId}`, payload);
  }
  updateProposal(proposalId: string, problemId: string, payload: Proposal) {
    return this.http.put(`${this.baseUrl}/proposals/${proposalId}?problem_id=${problemId}`, payload);
  }
  deleteProposal(proposalId: string, problemId: string) {
    return this.http.delete(`${this.baseUrl}/proposals/${proposalId}`, {
      params: { problem_id: problemId }
    });
  }
  
}

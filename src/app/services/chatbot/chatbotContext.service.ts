import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { BehaviorSubject, filter } from 'rxjs';
import { AuthenticationService } from '../authentication.service';

@Injectable({ providedIn: 'root' })
export class ChatbotContextService {
  public route$ = new BehaviorSubject<string>('');
  public problemId$ = new BehaviorSubject<string | null>(null);
  public proposalId$ = new BehaviorSubject<string | null>(null);
  public scenarioIds$ = new BehaviorSubject<string[]>([]);
  public parameters$ = new BehaviorSubject<any>({});

  constructor(private router: Router, private authSvc: AuthenticationService) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.route$.next(event.urlAfterRedirects);
    });
  }
  
  setContext(
    problemId: string | null, 
    proposalId: string | null = null, 
    scenarios: string[] = [], 
    parameters: any = {}
  ) {
    this.problemId$.next(problemId);
    this.proposalId$.next(proposalId);
    this.scenarioIds$.next(scenarios);
    this.parameters$.next(parameters);
  }

  getPayloadContext() {
    return {
      route: this.route$.getValue(),
      tenant: this.authSvc.activeTenant,
      problem_id: this.problemId$.getValue(),
      proposal_id: this.proposalId$.getValue(),
      scenario_ids: this.scenarioIds$.getValue(),
      parameters: this.parameters$.getValue()
    };
  }
}
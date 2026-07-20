import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ChatbotContextService {
  public problemId$ = new BehaviorSubject<string | null>(null);
  public scenarioIds$ = new BehaviorSubject<string[]>([]);
  
  setContext(problemId: string | null, scenarios: string[] = []) {
    this.problemId$.next(problemId);
    this.scenarioIds$.next(scenarios);
  }
}
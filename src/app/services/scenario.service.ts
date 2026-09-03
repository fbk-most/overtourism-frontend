import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ProblemScenario } from '../models/scenario.model';
import { Observable, BehaviorSubject, map, filter, shareReplay, switchMap } from 'rxjs';
import dataExample from '../../assets/dataExample.json';
import { ConfigService } from './config.service';
import { environment } from '../../environments/environment';
import { AuthenticationService } from './authentication.service';

// interface ScenarioResponse {
//   scenarios: Array<{
//     problem_id: string;
//     scenario_id: string;
//     scenario_name: string;
//     scenario_description: string;
//     index_diffs?: { [key: string]: number };
//   }>;
// }
export interface AppConfiguration {
  indexes: Widget[];
  map: any[]; 
  color_map: any[];
}
export interface Widget {
  name: string;
  label: string;
  kind?: string;
  category?: string;
  description?: string;
  unit?: string;
  min_value?: number | null;
  max_value?: number | null;
  step?: number | null;
  support?: string[];
  default?: any;
  default_category?: string | null;
  default_range?: any;
  
  // -- Proprietà interne salvate a runtime per la UI --
  v?: string | number;
  vMin?: number;
  vMax?: number;
  loc?: number;
  scale?: number;
}
@Injectable({
  providedIn: 'root'
})
export class ScenarioService {

  private baseUrl: string;
  private configuration$: Observable<AppConfiguration>;

  constructor(private http: HttpClient, private configService: ConfigService,private authService: AuthenticationService) {
    this.baseUrl = environment.apiBaseUrl;

    this.configuration$ = this.authService.activeTenant$.pipe(
      filter(tenant => !!tenant),
      switchMap(() => this.http.get<AppConfiguration>(`${this.baseUrl}/configuration`)),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.configuration$.subscribe(); 
  }
  saveSessionScenario(
    sessionId: string,
    scenarioId: string,
    version: number,
    problemId: string,
    proposalId: string,
    name: string,
    description: string,
    changedWidgets: Record<string, any>  ): Observable<any> {
    
    const indexValues = Object.keys(changedWidgets || {}).map(key => ({
      index_id: key,
      value: changedWidgets[key]
    }));

    const payload = {
      problem_id: problemId,
      scenario_id: scenarioId,
      version:version,
      proposal_id: proposalId,
      name: name,
      description: description,
      param_overrides: changedWidgets
        };

    return this.http.post<any>(
      `${this.baseUrl}/sessions/${sessionId}/scenarios/${scenarioId}`,
      payload,
      { params: { problem_id: problemId } }
    );
  }
  arrayToDict(values: any): Record<string, any> {
    if (!values) return {};
    if (Array.isArray(values)) {
      const dict: Record<string, any> = {};
      values.forEach(v => {
        if (!v) return;
        const key = v.index_id || v.index_name;
        const val = v.index_value !== undefined ? v.index_value : v.value;
        if (key && val !== undefined) dict[key] = val;
      });
      return dict;
    }
    return typeof values === 'object' ? values : {};
  }
  getScenarioData(scenarioId: string, problemId: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/scenarios/${scenarioId}`,{
      params: { problem_id: problemId }
    });
  }

  createSession(problemId: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/sessions`, {}, {
      params: { problem_id: problemId }
    });
  }
  
  createSessionScenario(
    sessionId: string,
    problemId: string,
    baseScenarioId: string,
    values: Record<string, any>
  ): Observable<any> {
    const payload = {
      base_scenario_id: baseScenarioId,
      // name: "Temp Session Scenario",
      // description: "Auto-generated for session preview",
      param_overrides: values
    };
    return this.http.post<any>(`${this.baseUrl}/sessions/${sessionId}/scenarios`, payload, {
      params: { problem_id: problemId }
    });
  }
  createSessionEvaluation(
    sessionId: string,
    problemId: string,
    scenarioId: string
  ): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/sessions/${sessionId}/evaluations`, 
      { scenario_id: scenarioId }, 
      { params: { problem_id: problemId } }
    );
  }

  getSessionEvaluationData(
    sessionId: string,
    evaluationId: string,
    problemId: string
  ): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/sessions/${sessionId}/evaluations/${evaluationId}/data`, {
      params: { problem_id: problemId,as_snapshot:false }
    });
  }
  
  getEvaluations(problemId: string, scenarioId?: string): Observable<any[]> {
    let params = new HttpParams().set('problem_id', problemId);
    if (scenarioId) {
      params = params.set('scenario_id', scenarioId); 
    }
    return this.http.get<any[]>(`${this.baseUrl}/evaluations`, { params });
  }
  getEvaluationData(evaluationId: string, problemId: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/evaluations/${evaluationId}/data`, {
      params: { problem_id: problemId ,as_snapshot:false}
    });
  }
  getUpdatedPlotInput(
    scenarioId: string,
    problemId: string,
    values: Record<string, number | [number, number]>
  ): Observable<any> {
    return this.http.put<any>(
      `${this.baseUrl}/scenarios/${scenarioId}`,
      { values }, // body
      { params: { problem_id: problemId } } // query
    );
  }
  deleteScenario(scenarioId: string, problemId: string,proposalId:string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/scenarios/${scenarioId}`,
      { params: { problem_id: problemId, proposal_id:proposalId} }
    );
  }

  getScenarios(problemId: string, proposalId?: string): Observable<ProblemScenario[]> {
    let params = new HttpParams().set('problem_id', problemId);
    
    if (proposalId) {
      params = params.set('proposal_id', proposalId);
    }
    
    return this.http
      .get<any[]>(`${this.baseUrl}/scenarios`, { params })
      .pipe(
        map(response => response.map(scenario => ({
          id: scenario.scenario_id, 
          scenario_id: scenario.scenario_id,
          problem_id: scenario.problem_id,
          version: scenario.version,
          
          name: scenario.name,
          description: scenario.description,
          
          created: scenario.created,
          updated: scenario.updated,
          extras: scenario.extras,
          
          index_values: scenario.index_values || []
        })))
      );
  }

  // getScenariosByProblemId(problemId: string): Observable<ProblemScenario[]> {
  //   const params = new HttpParams().set('problem_id', problemId);

  //   return this.http
  //     .get<ScenarioResponse>(`${this.baseUrl}/scenarios`, { params })
  
  //     .pipe(
  //       map(response => response.scenarios.map(scenario => ({
  //         id: scenario.scenario_id,
  //         name: scenario.scenario_name,
  //         description: scenario.scenario_description,
  //         problemId: scenario.problem_id,
  //         index_diffs: scenario.index_diffs || {}
  //       })))
  //     );
  // }
  getConfiguration(): Observable<AppConfiguration> {
    return this.configuration$;
  }
  getTenants(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/default/tenants`);
  }
  getWidgets(): Observable<Widget[]> {
    return this.getConfiguration().pipe(map(config => config.indexes || []));
  }

  private currentScenarioSubject = new BehaviorSubject<any>(null);
  public currentScenario$ = this.currentScenarioSubject.asObservable();

  get currentScenario(): any {
    return this.currentScenarioSubject.value;
  }

  async fetchScenarioData(): Promise<any> {
    const scenarioData = dataExample; 
    this.currentScenarioSubject.next(scenarioData);
    return scenarioData;
  }


}

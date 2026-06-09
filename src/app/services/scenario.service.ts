import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ProblemScenario } from '../models/scenario.model';
import { Observable, BehaviorSubject, map } from 'rxjs';
import dataExample from '../../assets/dataExample.json';
import { ConfigService } from './config.service';
import { environment } from '../../environments/environment';

interface ScenarioResponse {
  scenarios: Array<{
    problem_id: string;
    scenario_id: string;
    scenario_name: string;
    scenario_description: string;
    index_diffs?: { [key: string]: number };
  }>;
}
export interface Widget {
scale?: any;
  index_id: string;
  index_name: string;
  index_category?: string;
  index_type?: string;
  group: string;
  editable: boolean;
  description?: string;
  min: number;
  max: number;
  step: number;
  v?: number;
  loc?: number;
  vMin?: number;
  vMax?: number;
}
@Injectable({
  providedIn: 'root'
})
export class ScenarioService {

  private baseUrl: string;

  constructor(private http: HttpClient, private configService: ConfigService) {
    this.baseUrl = environment.apiBaseUrl;
  }
  saveNewScenario(scenarioId: string, problemId: string, proposalId:string, values: Record<string, number | [number, number]>, titolo: string, descrizione: string)
    : Observable<any> {
    return this.http.post<any>(
      `${this.baseUrl}/scenarios/${scenarioId}`,
      { 
        values, 
        name: titolo,             
        description: descrizione   
       },  
      { params: { problem_id: problemId, proposal_id:proposalId } }  
    );
  }
  getScenarioData(scenarioId: string, problemId: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/scenarios/${scenarioId}`,{
      params: { problem_id: problemId }
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
  
  getWidgets(): Observable<Record<string, Widget[]>> {
    return this.http.get<{ widgets: Record<string, Widget[]> }>(
      `${this.baseUrl}/widgets`
    ).pipe(map(res => res.widgets));
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

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { Problem } from '../models/problem.model';
import { ConfigService } from './config.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProblemService {
  private baseUrl: string;

  constructor(private http: HttpClient, private configService: ConfigService) {
    this.baseUrl = environment.apiBaseUrl;
  }

  /** GET all problems */
  getProblems(): Observable<Problem[]> {
    return this.http.get<any[]>(`${this.baseUrl}/problems`).pipe(
      map(response =>
        response.map(problem => ({
          problem_id: problem.problem_id,
          version: problem.version,
          tenant: problem.tenant,
          name: problem.name,
          description: problem.description,
          updated: problem.updated ? new Date(problem.updated) : undefined,
          created: problem.created ? new Date(problem.created) : undefined,
          extras: problem.extras
        }))
      )
    );
  }

  /** POST create new problem */
  createProblem(problem: Problem): Observable<Problem> {
    return this.http.post<Problem>(`${this.baseUrl}/problems`, problem);
  }

  /** GET single problem by ID */
  getProblemById(problemId: string): Observable<Problem> {
    return this.http.get<Problem>(`${this.baseUrl}/problems/${problemId}`);
  }

  /** DELETE problem by ID */
  deleteProblem(problemId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/problems/${problemId}`);
  }

  /** PUT refresh problems */
  refreshProblems(): Observable<any> {
    return this.http.put(`${this.baseUrl}/problems/refresh`, {});
  }
  /** PUT update problem */
updateProblem(problemId: string, payload: Problem): Observable<Problem> {
  const { problem_id, tenant, updated,...body } = payload;
  return this.http.put<Problem>(`${this.baseUrl}/problems/${problemId}`, body);
}
}

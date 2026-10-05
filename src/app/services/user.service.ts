import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthMe, AuthRole, AuthUser, CreateAuthUserDto, UpdateAuthUserDto } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getMe(): Observable<AuthMe> {
    return this.http.get<AuthMe>(`${this.baseUrl}/auth/me`);
  }

  getRoles(): Observable<AuthRole[]> {
    return this.http.get<AuthRole[]>(`${this.baseUrl}/auth/roles`);
  }

  getUsers(territory?: string): Observable<AuthUser[]> {
    let params = new HttpParams();
    if (territory) {
      params = params.set('territory', territory);
    }
    return this.http.get<AuthUser[]>(`${this.baseUrl}/auth/users`, { params });
  }

  createUser(payload: CreateAuthUserDto): Observable<AuthUser> {
    return this.http.post<AuthUser>(`${this.baseUrl}/auth/users`, payload);
  }

  updateUser(userId: string, payload: UpdateAuthUserDto): Observable<AuthUser> {
    return this.http.patch<AuthUser>(`${this.baseUrl}/auth/users/${userId}`, payload);
  }

  deactivateUser(userId: string): Observable<AuthUser> {
    return this.http.delete<AuthUser>(`${this.baseUrl}/auth/users/${userId}`);
  }
}
import { Injectable } from '@angular/core';
import { AuthConfig, OAuthEvent, OAuthService } from 'angular-oauth2-oidc';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import { NotificationService } from './notifications.service';
import { ChatbotService } from './chatbot/chatbot.service';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { AuthMe } from '../models/user.model';

export const authConfig: AuthConfig = {
  issuer: environment.auth.issuer,
  clientId: environment.auth.clientId,
  responseType: environment.auth.responseType,
  scope: environment.auth.scope,
  redirectUri: environment.auth.redirectUri,
  postLogoutRedirectUri: window.location.origin + '/', 
  clearHashAfterLogin: true,
  useSilentRefresh: false,
  timeoutFactor: 0.75,
  sessionChecksEnabled: false,
  showDebugInformation: true,
};

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  private readonly TERRITORY_KEY = 'active_territory';
  private activeTerritorySubject = new BehaviorSubject<string | null>(localStorage.getItem(this.TERRITORY_KEY));
  public activeTerritory$ = this.activeTerritorySubject.asObservable();

  private currentUserSubject = new BehaviorSubject<AuthMe | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private oauthService: OAuthService,
    private router: Router,
    private notificationService: NotificationService,
    private chatbotService: ChatbotService,
    private http: HttpClient
  ) {}

  public async initialLoginSequence(): Promise<void> {
    this.oauthService.configure(authConfig);
    this.oauthService.setupAutomaticSilentRefresh();
    this.oauthService.events.subscribe((event: OAuthEvent) => {
      switch (event.type) {
        case 'token_received':
          this.loadUserProfile();
          break;
        case 'token_refresh_error':
        case 'token_error':
        case 'session_terminated':
        case 'session_error':
          this.forceLocalLogout();
          break;
      }
    });

    if (window.location.search.includes('state') && !window.location.search.includes('code=')) {
      window.history.replaceState({}, window.document.title, window.location.pathname);
    }

    try {
      const authError = localStorage.getItem('auth_error');
      if (authError) {
        setTimeout(() => this.notificationService.showError(authError), 500);
        localStorage.removeItem('auth_error');
      }

      await this.oauthService.loadDiscoveryDocumentAndTryLogin();

      if (this.isLoggedIn) {
        const profile = await this.loadUserProfile();
        if (!profile) {
          this.handleUnauthorized();
          return;
        }
      }
    } catch (e: any) {
      if (e?.type === 'invalid_nonce_in_state') {
        this.oauthService.logOut(true); 
      }
    }
  }

  public async loadUserProfile(): Promise<AuthMe | null> {
    try {
      const profile = await firstValueFrom(this.http.get<AuthMe>(`${environment.apiBaseUrl}/auth/me`));
      
      if (!profile || profile.authenticated === false) {
        return null;
      }

      this.currentUserSubject.next(profile);
      return profile;
    } catch (err: any) {
      console.error('Errore durante il caricamento del profilo utente:', err);
      return null;
    }
  }

  /**
   * Gestisce l'accesso non autorizzato: salva il messaggio di errore ed esegue il logout federato
   */
  handleUnauthorized(): void {
    this.currentUserSubject.next(null);
    this.chatbotService.clearSession();
    localStorage.setItem('auth_error', 'Utente non autorizzato ad accedere all\'applicazione.');
    this.logout();
  }

  get currentUser(): AuthMe | null {
    return this.currentUserSubject.value;
  }

  get isAdmin(): boolean {
    const u = this.currentUser;
    return !!(u?.is_global_admin || u?.role === 'admin');
  }

  get isMultiEditor(): boolean {
    return this.currentUser?.role === 'multieditor';
  }

  get canManageUsers(): boolean {
    return this.isAdmin;
  }

  canEdit(territory?: string): boolean {
    const u = this.currentUser;
    if (!u) return false;
    
    if (this.isAdmin || this.isMultiEditor) return true;

    if (u.role === 'editor') {
      const targetTerritory = (territory || this.activeTerritory).toLowerCase();
      const userTerritories = (u.territories || []).map(t => t.toLowerCase());
      return userTerritories.includes(targetTerritory);
    }

    return false;
  }

  get isViewer(): boolean {
    return this.currentUser?.role === 'viewer';
  }

  get isLoggedIn(): boolean {
    return this.oauthService.hasValidAccessToken();
  }

  get accessToken(): string {
    return this.oauthService.getAccessToken();
  }

  get userName(): string {
    const claims: any = this.oauthService.getIdentityClaims();
    if (!claims) return '';
    return claims['given_name'] || claims['name'] || claims['preferred_username'] || '';
  }

  login() {
    this.oauthService.initCodeFlow();
  }

  logout() {
    this.currentUserSubject.next(null);
    this.chatbotService.clearSession();
    this.router.navigate(['/login']).then(() => {
      this.oauthService.logOut();
    });
  }

  forceLocalLogout() {
    this.currentUserSubject.next(null);
    this.chatbotService.clearSession();
    this.oauthService.logOut(true);
    this.router.navigate(['/login']);
  }

  private _availableTerritories: string[] = [];
  
  get availableTerritories(): string[] {
    return this._availableTerritories;
  }

  setAvailableTerritories(territories: string[]): void {
    this._availableTerritories = (territories || []).filter(t => t.toLowerCase() !== 'default');
    
    const current = localStorage.getItem(this.TERRITORY_KEY);
    if (!current || !this._availableTerritories.includes(current)) {
      if (this._availableTerritories.length > 0) {
        this.setActiveTerritory(this._availableTerritories[0], false);
      }
    }
  }

  get activeTerritory(): string {
    let territory = localStorage.getItem(this.TERRITORY_KEY);
    if (!territory || (this._availableTerritories.length > 0 && !this._availableTerritories.includes(territory))) {
      if (this._availableTerritories.length > 0) {
        territory = this._availableTerritories[0];
        this.setActiveTerritory(territory, false);
      } else {
        return ''; 
      }
    }
    return territory;
  }

  setActiveTerritory(territory: string, reload: boolean = true) {
    localStorage.setItem(this.TERRITORY_KEY, territory);
    this.activeTerritorySubject.next(territory);

    if (reload) {
      this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
        this.router.navigate(['/problems']);
      });
    }
  }
}
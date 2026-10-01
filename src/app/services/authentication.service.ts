import { Injectable } from '@angular/core';
import { AuthConfig, OAuthEvent, OAuthService } from 'angular-oauth2-oidc';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import { NotificationService } from './notifications.service';
import { ChatbotService } from './chatbot/chatbot.service';
import { BehaviorSubject } from 'rxjs';

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

  constructor(private oauthService: OAuthService,
    private router: Router,
    private notificationService: NotificationService,
    private chatbotService: ChatbotService
  ) {}

  public async initialLoginSequence(): Promise<void> {
    this.oauthService.configure(authConfig);
    this.oauthService.setupAutomaticSilentRefresh();
    this.oauthService.events.subscribe((event: OAuthEvent) => {
      switch (event.type) {
        case 'token_received':
          console.log('Token rinnovato correttamente');
          break;

        case 'token_refresh_error':
        case 'token_error':
          console.warn(' Rinnovo token fallito:', event.type);
          this.forceLocalLogout();
          break;

        case 'session_terminated':
        case 'session_error':
          console.warn('Sessione terminata:', event.type);
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
        setTimeout(() => this.notificationService.showError(authError), 500); // 500ms altrimenti il Toast rischia di non essere ancora montato
        localStorage.removeItem('auth_error');
      }

      await this.oauthService.loadDiscoveryDocumentAndTryLogin();
      
      if (this.isLoggedIn) {
        this.extractTerritorysFromClaims();

        if (this.availableTerritorys.length === 0) {
          localStorage.setItem('auth_error', 'Utente non autorizzato ad accedere all\'applicazione.');
          this.logout()
                    return;
        }
      }
    } catch (e: any) {
      if (e?.type === 'invalid_nonce_in_state') {
        console.warn('Ignorato errore di stato disallineato post-logout');
        this.oauthService.logOut(true); 
      
      }
    }
  }

  private extractTerritorysFromClaims(): void {
    const claims: any = this.oauthService.getIdentityClaims() || {};
    const territorys = claims['tenant_id'];

    if (Array.isArray(territorys)) {
      this.setAvailableTerritorys(territorys);
    } else if (typeof territorys === 'string' && territorys.length > 0) {
      this.setAvailableTerritorys([territorys]);
    } else {
      this.setAvailableTerritorys([]);
    }
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
    this.chatbotService.clearSession();
    this.router.navigate(['/login']).then(() => {

    this.oauthService.logOut();
    });
  }
  forceLocalLogout() {
    this.chatbotService.clearSession();
    this.oauthService.logOut(true);
    this.router.navigate(['/login']);
  }
  private _availableTerritorys: string[] = [];
  
  get availableTerritorys(): string[] {
    return this._availableTerritorys;
  }

  setAvailableTerritorys(territorys: string[]): void {
    this._availableTerritorys = territorys;
  }

  get activeTerritory(): string {
    let territory = localStorage.getItem(this.TERRITORY_KEY);
    // Se non c'è un territory o quello salvato non fa più parte della lista
    if (!territory || (this._availableTerritorys.length > 0 && !this._availableTerritorys.includes(territory))) {
      if (this._availableTerritorys.length > 0) {
        territory = this._availableTerritorys[0];
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
    this.router.routeReuseStrategy.shouldReuseRoute = () => false;
    this.router.onSameUrlNavigation = 'reload';

    this.router.navigate(['/problems']).then(() => {
      console.log("relaoded data for territory change");
    });
  }
}
}
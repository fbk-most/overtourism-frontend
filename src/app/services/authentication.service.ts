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
  private readonly TENANT_KEY = 'active_tenant';
  private activeTenantSubject = new BehaviorSubject<string | null>(localStorage.getItem(this.TENANT_KEY));
  public activeTenant$ = this.activeTenantSubject.asObservable();

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
      
      // if (this.isLoggedIn && this.availableTenants.length === 0) {
      //   localStorage.setItem('auth_error', 'Utente non abilitato: nessun contesto associato al profilo.');
      //   this.oauthService.logOut(); 
      //   return; 
      // }
    } catch (e: any) {
      if (e?.type === 'invalid_nonce_in_state') {
        console.warn('Ignorato errore di stato disallineato post-logout');
        this.oauthService.logOut(true); 
      
      }
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
    this.oauthService.logOut(true);
    this.router.navigate(['/login']);
  }
  private _availableTenants: string[] = [];
  
  get availableTenants(): string[] {
    return this._availableTenants;
  }

  setAvailableTenants(tenants: string[]): void {
    this._availableTenants = tenants;
  }

  get activeTenant(): string {
    let tenant = localStorage.getItem(this.TENANT_KEY);
    // Se non c'è un tenant o quello salvato non fa più parte della lista
    if (!tenant || (this._availableTenants.length > 0 && !this._availableTenants.includes(tenant))) {
      if (this._availableTenants.length > 0) {
        tenant = this._availableTenants[0];
        this.setActiveTenant(tenant, false);
      } else {
        return ''; 
      }
    }
    return tenant;
  }

setActiveTenant(tenant: string, reload: boolean = true) {
  localStorage.setItem(this.TENANT_KEY, tenant);
  this.activeTenantSubject.next(tenant);

  if (reload) {
    this.router.routeReuseStrategy.shouldReuseRoute = () => false;
    this.router.onSameUrlNavigation = 'reload';

    this.router.navigate(['/problems']).then(() => {
      console.log("relaoded data for tenant change");
    });
  }
}
}
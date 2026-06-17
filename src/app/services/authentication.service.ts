import { Injectable } from '@angular/core';
import { AuthConfig, OAuthEvent, OAuthService } from 'angular-oauth2-oidc';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';

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
    showDebugInformation: false,
};

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  private readonly TENANT_KEY = 'active_tenant';

  constructor(private oauthService: OAuthService,private router: Router ) {}

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
      await this.oauthService.loadDiscoveryDocumentAndTryLogin();
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
    this.router.navigate(['/login']).then(() => {

    this.oauthService.logOut();
    });
  }
  forceLocalLogout() {
    this.oauthService.logOut(true);
    this.router.navigate(['/login']);
  }
get availableTenants(): string[] {
  const claims: any = this.oauthService.getIdentityClaims();
  return claims?.['tenant_id'] || ['default'];
}

get activeTenant(): string {
  let tenant = localStorage.getItem(this.TENANT_KEY);
  if (!tenant || !this.availableTenants.includes(tenant)) {
    tenant = this.availableTenants.length > 0 ? this.availableTenants[0] : 'default';
    this.setActiveTenant(tenant, false);
  }
  return tenant;
}

setActiveTenant(tenant: string, reload: boolean = true) {
  localStorage.setItem(this.TENANT_KEY, tenant);
  
  if (reload) {
    this.router.routeReuseStrategy.shouldReuseRoute = () => false;
    this.router.onSameUrlNavigation = 'reload';

    this.router.navigate(['/problems']).then(() => {
      console.log("relaoded data for tenant change");
    });
  }
}
}
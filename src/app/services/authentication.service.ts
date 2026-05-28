import { Injectable } from '@angular/core';
import { AuthConfig, OAuthService } from 'angular-oauth2-oidc';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';

export const authConfig: AuthConfig = {
  issuer: environment.auth.issuer,
  clientId: environment.auth.clientId,
  responseType: environment.auth.responseType,
  scope: environment.auth.scope,
  redirectUri: environment.auth.redirectUri,
  postLogoutRedirectUri: window.location.origin + '/', 
  clearHashAfterLogin: true
};

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  private readonly TENANT_KEY = 'active_tenant';

  constructor(private oauthService: OAuthService,private router: Router ) {}

  public async initialLoginSequence(): Promise<void> {
    this.oauthService.configure(authConfig);
    this.oauthService.setupAutomaticSilentRefresh();

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

  get userName(): string {
    const claims: any = this.oauthService.getIdentityClaims();
    if (!claims) return '';
    return claims['given_name'] || claims['name'] || claims['preferred_username'] || '';
  }

  login() {
    this.oauthService.initCodeFlow();
  }

  logout() {
    this.oauthService.logOut();
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
        this.router.navigate([this.router.url]).then(() => {
      // Opzionale: rimettiamolo a true se avevi logiche particolari, 
      // ma di solito lasciarlo resettato qui va benissimo per app di questo tipo.
    });
  }
}
}
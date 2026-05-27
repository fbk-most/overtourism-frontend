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
}
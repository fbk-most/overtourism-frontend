export const environment = {
    production: true,
    apiBaseUrl: (window as any)['env']['apiBaseUrl'] || 'https://overtourism.digitalhub-test.smartcommunitylab.it/api/v2',
    auth: {
      issuer: (window as any)['env']?.['issuer'] || '',
      clientId: (window as any)['env']?.['clientId'] || '',
      responseType: 'code',
      scope: 'openid profile email',
      redirectUri: window.location.origin + '/'
    }
  };

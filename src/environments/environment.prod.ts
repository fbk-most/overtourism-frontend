export const environment = {
  production: true,
  apiBaseUrl: (window as any)['env']?.['apiBaseUrl'] ?? 'https://overtourism.smartcommunitylab.it/api/v2',
  agentApiUrl: (window as any)['env']?.['agentApiUrl'] ?? 'https://overtourism.smartcommunitylab.it/agent',
  auth: {
    issuer: (window as any)['env']?.['issuer'] ?? 'https://aac.platform.smartcommunitylab.it',
    clientId: (window as any)['env']?.['clientId'] ?? 'c_50e8e205e30243588df8f1ad9425831a',
    responseType: 'code',
    scope: 'openid profile offline_access email',
    redirectUri: window.location.origin + '/'
  }
};
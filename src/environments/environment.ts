export const environment = {
  production: false,
  apiBaseUrl: (window as any)['env']?.['apiBaseUrl'] ?? 'http://localhost:8000/api',
  agentApiUrl: (window as any)['env']?.['agentApiUrl'] ?? 'http://localhost:9000/agent',
  cartoApiKey: (window as any)['env']?.['cartoApiKey'] ?? '',
  auth: {
    issuer: (window as any)['env']?.['issuer'] ?? 'https://aac.platform.smartcommunitylab.it',
    clientId: (window as any)['env']?.['clientId'] ?? 'c_50e8e205e30243588df8f1ad9425831a',
    responseType: (window as any)['env']?.['responseType'] ?? 'code',
    scope: (window as any)['env']?.['scope'] ??'openid profile offline_access email',
    redirectUri: (window as any)['env']?.['redirectUri'] ?? window.location.origin + '/'
  }
};
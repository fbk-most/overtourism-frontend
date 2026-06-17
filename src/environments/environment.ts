export const environment = {
  production: false,
  apiBaseUrl: 'http://127.0.0.1:8000/api/v2',
  agentApiUrl: 'http://localhost:9000/agent',
  auth: {
    issuer: 'https://aac.platform.smartcommunitylab.it', 
    clientId: 'c_50e8e205e30243588df8f1ad9425831a',
    responseType: 'code',
    scope: 'openid profile offline_access email',
    redirectUri: window.location.origin + '/'
  }
};
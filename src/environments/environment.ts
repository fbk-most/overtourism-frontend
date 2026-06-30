export const environment = {
  production: false,
  apiBaseUrl: 'https://overtourism.digitalhub-test.smartcommunitylab.it/api/v2',
  agentApiUrl: 'https://overtourism.digitalhub-test.smartcommunitylab.it/agent',
  auth: {
    issuer: 'https://aac.platform.smartcommunitylab.it', 
    clientId: 'c_50e8e205e30243588df8f1ad9425831a',
    responseType: 'code',
    scope: 'openid profile offline_access email',
    redirectUri: window.location.origin + '/'
  }
};
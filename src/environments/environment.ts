export const environment = {
  production: false,
  apiBaseUrl: 'http://127.0.0.1:8000/api/v1',
  auth: {
    issuer: 'https://aac.platform.smartcommunitylab.it', 
    clientId: 'c_e550ec7f86174720872ac9c36fbecdcb',
    responseType: 'code',
    scope: 'openid profile email',
    redirectUri: window.location.origin + '/'
  }
};
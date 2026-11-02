# Overtourism Frontend

The application will be available at `http://localhost:8080`

### Environment Variables

| Variable | Description | Default Value |
|----------|-------------|---------------|
| `API_BASE_URL` | Base URL for the backend API | `http://localhost:8000/api` |
| `AGENT_API_URL` | URL for the AI Agent backend | `http://localhost:9000/agent` |
| `CARTO_API_KEY` | API Key for CARTO basemap tiles | *(empty)* |
| `ISSUER` | OIDC Authentication Issuer URL | `https://your-auth-issuer.example.com` |
| `CLIENT_ID` | OIDC Client ID | `your-client-id` |

## Angular app development

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.12.

The application needs Node.js v20 for running: https://nodejs.org/en/download

### Local Environment Setup

Before starting the application locally, you must configure your local environment file:

### 1. Configure environment file

Create `src/assets/env.js` starting from the template (this file is ignored by git and will not be committed):

```bash
cp src/assets/env.template.js src/assets/env.js
```

### 2. Set local configuration values
Open env.js and set your local configuration values and secret keys:

```bash
(function (window) {
  window['env'] = window['env'] || {};
  window['env']['apiBaseUrl'] = 'http://localhost:8000/api';
  window['env']['agentApiUrl'] = 'http://localhost:9000/agent';
  window['env']['cartoApiKey'] = 'YOUR_CARTO_API_KEY';
  window['env']['issuer'] = 'https://your-auth-issuer.example.com';
  window['env']['clientId'] = 'YOUR_CLIENT_ID';
  window['env']['scope'] = 'openid profile offline_access email';
})(this);
```
Note: If env.js is missing, the app will fall back to default values defined in environment.ts.

### 3. Install packages
Install dependencies

```bash
npm i
```
### 4. Development server

To start a local development server, run:
```bash
npm run start
```

## Angular app development

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.12.

The application needs Node.js v20 for running: https://nodejs.org/en/download


## Docker

### Building the Container

To build the Docker container, run:

```bash
docker build -t tn-aixpa/overtourism-frontend .
```

If you need to use the cache image for faster builds:

```bash
docker build --build-arg CACHE=tn-aixpa/overtourism-frontend:cache -t overtourism-frontend .
```

### Running the Container

The container supports runtime configuration of the API base URL through environment variables. Here are some examples of how to run the container:

1. With default API URL:
```bash
docker run -p 8080:8080 tn-aixpa/overtourism-frontend
```

2. With custom API URL:
```bash
docker run -p 8080:8080 -e API_BASE_URL=https://your-api-url.com/api/v1 tn-aixpa/overtourism-frontend
```

3. For development or testing with a local API:
```bash
docker run -p 8080:8080 -e API_BASE_URL=http://localhost:8081/api/v1 tn-aixpa/overtourism-frontend
```

The application will be available at `http://localhost:8080`

### Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

### Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.


### Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

### Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

### Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## License 

```
SPDX-License-Identifier: Apache-2.0
```

import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { AuthenticationService } from './authentication.service';
import {
  AGENT_STREAM_TRANSPORT,
  AgentSessionUnavailableError,
  AgentService,
  AgentStreamConnection,
  AgentStreamOutcome,
  AgentStreamTransport
} from './agent.service';
import { AgentResponse } from '../models/chat.model';
import { PageContextPayload } from '../models/page-context.model';
import { PageContextService } from './chatbot/page-context.service';
import { environment } from '../../environments/environment';

class MockAgentStreamTransport implements AgentStreamTransport {
  outcomes: AgentStreamOutcome[] = [];
  eventIds: Array<string | null> = [];
  tokens: string[] = [];

  connect(
    _url: string,
    token: string,
    lastEventId: string | null,
    onEventId: (id: string) => void
  ): AgentStreamConnection {
    this.tokens.push(token);
    this.eventIds.push(lastEventId);
    const outcome = this.outcomes.shift() ?? { kind: 'done' as const };
    if ('eventId' in outcome && typeof outcome.eventId === 'string') {
      onEventId(outcome.eventId);
    }
    return {
      completion: Promise.resolve(outcome),
      close: () => undefined
    };
  }
}

describe('AgentService turn protocol', () => {
  let service: AgentService;
  let http: HttpTestingController;
  let stream: MockAgentStreamTransport;

  beforeEach(() => {
    localStorage.clear();
    stream = new MockAgentStreamTransport();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AgentService,
        {
          provide: AuthenticationService,
          useValue: { accessToken: 'test-token', activeTerritory: 'test-territory', isLoggedIn: true }
        },
        { provide: AGENT_STREAM_TRANSPORT, useValue: stream }
      ]
    });
    service = TestBed.inject(AgentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the selected force_role with the message', fakeAsync(() => {
    localStorage.setItem('chatbot_session_id', 'server-session');
    let response: AgentResponse | undefined;
    void service.sendMessage('hello', { force_role: 'operative' }).then(result => { response = result; });
    flushMicrotasks();

    const messageRequest = http.expectOne(environment.agentApiUrl);
    expect((messageRequest.request.body as FormData).get('force_role')).toBe('operative');
    messageRequest.flush({ session_id: 'server-session', turn_id: 'turn-role' });
    flushMicrotasks();

    http.expectOne(`${environment.agentApiUrl}/turns/turn-role`).flush({
      turn_id: 'turn-role',
      session_id: 'server-session',
      status: 'done',
      last_event_id: 0,
      result: { response: 'Role applied.' }
    });
    flushMicrotasks();

    expect(response?.response).toBe('Role applied.');
  }));

  it('retries the same message with the same Idempotency-Key', fakeAsync(() => {
    localStorage.setItem('chatbot_session_id', 'server-session');
    let response: AgentResponse | undefined;
    void service.sendMessage('hello').then(result => { response = result; });
    flushMicrotasks();

    const firstPost = http.expectOne(environment.agentApiUrl);
    const key = firstPost.request.headers.get('Idempotency-Key');
    expect(key).toBeTruthy();
    expect(firstPost.request.headers.get('Authorization')).toBe('Bearer test-token');
    firstPost.error(new ProgressEvent('network error'));
    flushMicrotasks();

    tick(250);
    flushMicrotasks();
    const retriedPost = http.expectOne(environment.agentApiUrl);
    expect(retriedPost.request.headers.get('Idempotency-Key')).toBe(key);
    retriedPost.flush({ session_id: 'server-session', turn_id: 'turn-1' });
    flushMicrotasks();

    const resultRequest = http.expectOne(`${environment.agentApiUrl}/turns/turn-1`);
    resultRequest.flush({
      turn_id: 'turn-1',
      session_id: 'server-session',
      status: 'done',
      last_event_id: 0,
      result: { response: 'Hello back.' }
    });
    flushMicrotasks();

    expect(response?.response).toBe('Hello back.');
    expect(stream.tokens).toEqual(['test-token']);
  }));

  it('attaches to the active turn returned with a 409', fakeAsync(() => {
    localStorage.setItem('chatbot_session_id', 'server-session');
    let response: AgentResponse | undefined;
    void service.sendMessage('hello').then(result => { response = result; });
    flushMicrotasks();

    http.expectOne(environment.agentApiUrl).flush(
      { detail: { message: 'Already running', active_turn_id: 'turn-active' } },
      { status: 409, statusText: 'Conflict' }
    );
    flushMicrotasks();

    const resultRequest = http.expectOne(`${environment.agentApiUrl}/turns/turn-active`);
    resultRequest.flush({
      turn_id: 'turn-active',
      session_id: 'server-session',
      status: 'done',
      last_event_id: 0,
      result: { response: 'The active reply.' }
    });
    flushMicrotasks();

    expect(response?.response).toBe('The active reply.');
    expect(stream.eventIds).toEqual([null]);
  }));

  it('falls back to polling after three SSE drops', fakeAsync(() => {
    localStorage.setItem('chatbot_session_id', 'server-session');
    stream.outcomes = [
      { kind: 'failed', eventId: '17' } as AgentStreamOutcome & { eventId: string },
      { kind: 'failed' },
      { kind: 'failed' }
    ];
    let response: AgentResponse | undefined;
    void service.sendMessage('hello').then(result => { response = result; });
    flushMicrotasks();
    http.expectOne(environment.agentApiUrl).flush({
      session_id: 'server-session',
      turn_id: 'turn-drop'
    });
    flushMicrotasks();

    tick(300);
    flushMicrotasks();
    tick(600);
    flushMicrotasks();

    const firstPoll = http.expectOne(`${environment.agentApiUrl}/turns/turn-drop`);
    firstPoll.flush({
      turn_id: 'turn-drop',
      session_id: 'server-session',
      status: 'running',
      last_event_id: 17,
      result: null
    });
    flushMicrotasks();
    tick(1500);
    flushMicrotasks();

    const secondPoll = http.expectOne(`${environment.agentApiUrl}/turns/turn-drop`);
    secondPoll.flush({
      turn_id: 'turn-drop',
      session_id: 'server-session',
      status: 'done',
      last_event_id: 17,
      result: { response: 'Recovered by polling.' }
    });
    flushMicrotasks();

    expect(stream.eventIds).toEqual([null, '17', '17']);
    expect(response?.response).toBe('Recovered by polling.');
  }));

  it('returns the user-facing result for a timeout status', fakeAsync(() => {
    localStorage.setItem('chatbot_session_id', 'server-session');
    let response: AgentResponse | undefined;
    void service.sendMessage('hello').then(result => { response = result; });
    flushMicrotasks();
    http.expectOne(environment.agentApiUrl).flush({
      session_id: 'server-session',
      turn_id: 'turn-timeout'
    });
    flushMicrotasks();

    http.expectOne(`${environment.agentApiUrl}/turns/turn-timeout`).flush({
      turn_id: 'turn-timeout',
      session_id: 'server-session',
      status: 'timeout',
      last_event_id: 5,
      result: { response: 'The request took too long.' }
    });
    flushMicrotasks();

    expect(response?.response).toBe('The request took too long.');
  }));

  it('resumes an active turn after loading a stored session', fakeAsync(() => {
    localStorage.setItem('chatbot_session_id', 'server-session');
    let response: AgentResponse | null | undefined;
    void service.resumeIfRunning().then(result => { response = result; });
    flushMicrotasks();

    http.expectOne(`${environment.agentApiUrl}/session/server-session`).flush({
      session_id: 'server-session',
      active_turn_id: 'turn-resume',
      latest_turn_id: 'turn-resume'
    });
    flushMicrotasks();

    http.expectOne(`${environment.agentApiUrl}/turns/turn-resume`).flush({
      turn_id: 'turn-resume',
      session_id: 'server-session',
      status: 'done',
      last_event_id: 9,
      result: { response: 'Resumed reply.' }
    });
    flushMicrotasks();

    expect(response?.response).toBe('Resumed reply.');
  }));

  it('clears the stored session and reports it as unavailable when resume gets a 404', fakeAsync(() => {
    localStorage.setItem('chatbot_session_id', 'gone-session');
    let failure: unknown;
    void service.resumeIfRunning().catch(error => { failure = error; });
    flushMicrotasks();

    http.expectOne(`${environment.agentApiUrl}/session/gone-session`).flush(
      { detail: 'Session not found' },
      { status: 404, statusText: 'Not Found' }
    );
    flushMicrotasks();

    expect(localStorage.getItem('chatbot_session_id')).toBeNull();
    expect(failure).toEqual(jasmine.any(AgentSessionUnavailableError));
  }));

  it('initializes a replacement session after a 404 and asks the user to resend', fakeAsync(() => {
    localStorage.setItem('chatbot_session_id', 'missing-session');
    let failure: unknown;
    void service.sendMessage('hello').catch(error => { failure = error; });
    flushMicrotasks();

    http.expectOne(environment.agentApiUrl).flush(
      { detail: { message: 'Session not found' } },
      { status: 404, statusText: 'Not Found' }
    );
    flushMicrotasks();

    const initRequest = http.expectOne(`${environment.agentApiUrl}/init`);
    initRequest.flush({
      session_id: 'replacement-session',
      session_mode: 'standalone',
      allowed_territories: []
    });
    flushMicrotasks();

    expect(localStorage.getItem('chatbot_session_id')).toBe('replacement-session');
    expect(failure).toEqual(jasmine.any(AgentSessionUnavailableError));
  }));

  it('sends integrated references to init as typed context entries', fakeAsync(() => {
    let response: unknown;
    void service.init({
      mode: 'integrated',
      language: 'Italian',
      context: { problem_id: 'p-1', scenario_ids: ['s-1', 's-2'] }
    }).then(result => { response = result; });

    const initRequest = http.expectOne(`${environment.agentApiUrl}/init`);
    const formData = initRequest.request.body as FormData;
    expect(formData.get('user_lang')).toBe('Italian');
    expect(formData.get('integrated_mode')).toBe('true');
    expect(formData.getAll('context')).toEqual([
      'problem:p-1',
      'scenario:s-1',
      'scenario:s-2'
    ]);
    initRequest.flush({
      session_id: 'integrated-session',
      session_mode: 'integrated',
      allowed_territories: []
    });
    flushMicrotasks();

    expect(response).toBeTruthy();
  }));
});


describe('AgentService page context', () => {
  const snapshot = (route: string, revision = 1): PageContextPayload => ({
    schema_version: '1.0',
    captured_at: '2026-11-06T12:00:00.000Z',
    route,
    revision,
    elements: [{ id: 'save-button', type: 'button', label: 'Save', enabled: false }]
  });

  let service: AgentService;
  let http: HttpTestingController;
  let route: string;
  let loggedIn: boolean;
  let captureFails: boolean;
  let pageContext: { capture: jasmine.Spy | (() => PageContextPayload); currentRoute: () => string };

  beforeEach(() => {
    localStorage.clear();
    route = '/proposals/edit/123';
    loggedIn = true;
    captureFails = false;
    let revision = 0;
    pageContext = {
      capture: () => {
        if (captureFails) throw new Error('boom');
        return snapshot(route, ++revision);
      },
      currentRoute: () => route
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AgentService,
        {
          provide: AuthenticationService,
          useValue: {
            accessToken: 'test-token',
            activeTerritory: 'test-territory',
            get isLoggedIn() { return loggedIn; }
          }
        },
        { provide: AGENT_STREAM_TRANSPORT, useValue: new MockAgentStreamTransport() },
        { provide: PageContextService, useValue: pageContext }
      ]
    });
    service = TestBed.inject(AgentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const initIntegrated = () => {
    void service.init({ mode: 'integrated', context: { problem_id: 'p-1' } });
    const request = http.expectOne(`${environment.agentApiUrl}/init`);
    return request;
  };

  it('sends the page snapshot to integrated init, separate from the business context', fakeAsync(() => {
    const request = initIntegrated();
    const body = request.request.body as FormData;

    expect(body.getAll('context')).toEqual(['problem:p-1']);
    const sent = JSON.parse(body.get('page_context') as string) as PageContextPayload;
    expect(sent.route).toBe('/proposals/edit/123');
    expect(sent.schema_version).toBe('1.0');
    expect(sent.elements[0].id).toBe('save-button');
    expect(typeof sent.revision).toBe('number');
    // the business context must not carry any page information
    expect(body.getAll('context').join()).not.toContain('proposals/edit');

    request.flush({ session_id: 'srv', session_mode: 'integrated', allowed_territories: [] });
    flushMicrotasks();
    expect(localStorage.getItem('integrated_chatbot_session_id')).toBe('srv');
  }));

  it('starts an integrated chat on a page with no selected entity (e.g. the problems list)', fakeAsync(() => {
    route = '/problems';
    let error: unknown;
    void service.init({ mode: 'integrated', context: {} }).catch(e => (error = e));
    const request = http.expectOne(`${environment.agentApiUrl}/init`);
    const body = request.request.body as FormData;

    expect(body.getAll('context')).toEqual([]);
    expect(JSON.parse(body.get('page_context') as string).route).toBe('/problems');
    request.flush({ session_id: 'srv', session_mode: 'integrated', allowed_territories: [] });
    flushMicrotasks();
    expect(error).toBeUndefined();
    expect(localStorage.getItem('integrated_chatbot_session_id')).toBe('srv');
  }));

  it('refuses to start an integrated chat with neither an entity nor a page snapshot', () => {
    captureFails = true;
    spyOn(console, 'warn');

    expect(() => service.init({ mode: 'integrated', context: {} })).toThrowError(/requires/);
    http.expectNone(`${environment.agentApiUrl}/init`);
  });

  it('does not send a page snapshot from standalone mode', fakeAsync(() => {
    void service.init({ mode: 'standalone' });
    const request = http.expectOne(`${environment.agentApiUrl}/init`);

    expect((request.request.body as FormData).has('page_context')).toBeFalse();
    request.flush({ session_id: 's', session_mode: 'standalone', allowed_territories: [] });
    flushMicrotasks();
  }));

  it('still starts the chat when the snapshot cannot be captured', fakeAsync(() => {
    captureFails = true;
    spyOn(console, 'warn');
    const request = initIntegrated();

    expect((request.request.body as FormData).has('page_context')).toBeFalse();
    request.flush({ session_id: 'srv', session_mode: 'integrated', allowed_territories: [] });
    flushMicrotasks();
    expect(localStorage.getItem('integrated_chatbot_session_id')).toBe('srv');
  }));

  it('sends a fresh snapshot when the user navigated while the session was being created', fakeAsync(() => {
    const request = initIntegrated();
    route = '/scenarios';
    request.flush({ session_id: 'srv', session_mode: 'integrated', allowed_territories: [] });
    flushMicrotasks();

    const update = http.expectOne(`${environment.agentApiUrl}/context`);
    expect(JSON.parse((update.request.body as FormData).get('page_context') as string).route).toBe('/scenarios');
    update.flush({ status: 'updated', applied: true });
    flushMicrotasks();
  }));

  it('updatePageContext posts the snapshot to /context for the integrated session only', fakeAsync(() => {
    localStorage.setItem('integrated_chatbot_session_id', 'srv');
    void service.updatePageContext();
    flushMicrotasks();

    const request = http.expectOne(`${environment.agentApiUrl}/context`);
    const body = request.request.body as FormData;
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    expect(body.get('session_id')).toBe('srv');
    expect(JSON.parse(body.get('page_context') as string).route).toBe('/proposals/edit/123');
    expect(Array.from((body as any).keys()).sort()).toEqual(['page_context', 'session_id']);
    request.flush({ status: 'updated', applied: true, revision: 1, version: 2, active_turn_id: null });
    flushMicrotasks();
  }));

  it('updatePageContext sends nothing without an integrated session', fakeAsync(() => {
    localStorage.setItem('chatbot_session_id', 'standalone-session'); // standalone key only
    void service.updatePageContext();
    flushMicrotasks();

    http.expectNone(`${environment.agentApiUrl}/context`);
  }));

  it('updatePageContext sends nothing when logged out or on a page without the assistant', fakeAsync(() => {
    localStorage.setItem('integrated_chatbot_session_id', 'srv');
    loggedIn = false;
    void service.updatePageContext();
    flushMicrotasks();
    http.expectNone(`${environment.agentApiUrl}/context`);

    loggedIn = true;
    route = '/users/42';
    void service.updatePageContext();
    flushMicrotasks();
    http.expectNone(`${environment.agentApiUrl}/context`);
  }));

  it('updatePageContext swallows failures and keeps the session', fakeAsync(() => {
    localStorage.setItem('integrated_chatbot_session_id', 'srv');
    spyOn(console, 'warn');

    let settled = false;
    void service.updatePageContext().then(() => { settled = true; });
    flushMicrotasks();
    http.expectOne(`${environment.agentApiUrl}/context`).flush({ detail: 'Session not found' }, { status: 404, statusText: 'Not Found' });
    flushMicrotasks();

    expect(settled).toBeTrue();
    expect(localStorage.getItem('integrated_chatbot_session_id')).toBe('srv'); // sendMessage handles 404
    expect(console.warn).toHaveBeenCalledWith('Page context update failed', 404);
  }));

  it('does not put the snapshot on message requests (business context only)', fakeAsync(() => {
    localStorage.setItem('integrated_chatbot_session_id', 'srv');
    void service.sendMessage('hello', { mode: 'integrated', context: { problem_id: 'p-1' } });
    flushMicrotasks();

    const request = http.expectOne(environment.agentApiUrl);
    expect((request.request.body as FormData).has('page_context')).toBeFalse();
    request.flush({ session_id: 'srv', turn_id: 't1' });
    flushMicrotasks();
    http.expectOne(`${environment.agentApiUrl}/turns/t1`).flush({
      turn_id: 't1', session_id: 'srv', status: 'done', last_event_id: 1, result: { response: 'ok' }
    });
    flushMicrotasks();
  }));
});

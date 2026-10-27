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
          useValue: { accessToken: 'test-token', activeTerritory: 'test-territory' }
        },
        { provide: AGENT_STREAM_TRANSPORT, useValue: stream }
      ]
    });
    service = TestBed.inject(AgentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

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
    expect(formData.getAll('context[]')).toEqual([
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

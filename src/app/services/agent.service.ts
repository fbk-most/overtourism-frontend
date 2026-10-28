import { Inject, Injectable, InjectionToken } from '@angular/core';
import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams
} from '@angular/common/http';
import { firstValueFrom, Observable, TimeoutError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthenticationService } from './authentication.service';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { CUSTOM_TIMEOUT, SKIP_ERROR_NOTIFICATION } from '../interceptors/http-error.interceptor';
import { AgentResponse } from '../models/chat.model';

export type AgentChatMode = 'standalone' | 'integrated';

export interface AgentChatContext {
  problem_id?: string | null;
  proposal_id?: string | null;
  scenario_ids?: string[];
}

export interface AgentChatOptions {
  mode?: AgentChatMode;
  language?: string;
  context?: AgentChatContext;
}

export interface AgentInitResponse {
  session_id: string;
  session_mode: string;
  allowed_territories: string[];
}

interface AgentTurnResponse {
  turn_id: string;
}

interface AgentSessionResponse {
  session_id: string;
  active_turn_id: string | null;
  latest_turn_id: string | null;
}

interface AgentTurnResult {
  turn_id: string;
  session_id: string;
  status: 'running' | 'done' | 'failed' | 'timeout';
  last_event_id: number;
  result: AgentResponse | null;
}

export type AgentStreamOutcome = { kind: 'done' } | { kind: 'failed'; error?: unknown };

export interface AgentStreamConnection {
  completion: Promise<AgentStreamOutcome>;
  close(): void;
}

export interface AgentStreamTransport {
  connect(
    url: string,
    token: string,
    lastEventId: string | null,
    onEventId: (id: string) => void,
    onProgress: (message: string) => void
  ): AgentStreamConnection;
}

export const AGENT_STREAM_TRANSPORT = new InjectionToken<AgentStreamTransport>(
  'AGENT_STREAM_TRANSPORT',
  { providedIn: 'root', factory: () => new FetchAgentStreamTransport() }
);

class FetchAgentStreamTransport implements AgentStreamTransport {
  connect(
    url: string,
    token: string,
    lastEventId: string | null,
    onEventId: (id: string) => void,
    onProgress: (message: string) => void
  ): AgentStreamConnection {
    const controller = new AbortController();
    let settled = false;
    let resolveCompletion!: (outcome: AgentStreamOutcome) => void;
    const completion = new Promise<AgentStreamOutcome>(resolve => {
      resolveCompletion = resolve;
    });

    const finish = (outcome: AgentStreamOutcome): void => {
      if (settled) return;
      settled = true;
      controller.abort();
      resolveCompletion(outcome);
    };

    void fetchEventSource(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
        ...(lastEventId ? { 'Last-Event-ID': lastEventId } : {})
      },
      signal: controller.signal,
      onmessage(event) {
        if (event.id) onEventId(event.id);

        if (event.event === 'done') {
          finish({ kind: 'done' });
          return;
        }

        if (event.event !== 'status') return;

        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === 'action' && typeof payload.tool === 'string') {
            onProgress(`Running ${payload.tool}...`);
          }
        } catch (error) {
          finish({ kind: 'failed', error });
        }
      },
      onclose() {
        finish({ kind: 'failed' });
      },
      onerror(error) {
        finish({ kind: 'failed', error });
        throw error;
      }
    }).catch(error => finish({ kind: 'failed', error }));

    return {
      completion,
      close: () => {
        controller.abort();
        finish({ kind: 'failed' });
      }
    };
  }
}

export class AgentSessionUnavailableError extends Error {
  constructor() {
    super('The chat session is no longer available. Start a new message to continue.');
    this.name = 'AgentSessionUnavailableError';
  }
}

@Injectable({ providedIn: 'root' })
export class AgentService {
  private readonly apiUrl = environment.agentApiUrl;
  private readonly sessionStorageKeys: Record<AgentChatMode, string> = {
    standalone: 'chatbot_session_id',
    integrated: 'integrated_chatbot_session_id'
  };
  private readonly lastContextByMode: Partial<Record<AgentChatMode, string[]>> = {};
  private readonly requestTimeoutMs = 15000;
  private readonly streamTimeoutMs = 90000;
  private readonly pollIntervalMs = 1500;
  private readonly pollTimeoutMs = 6 * 60 * 1000;

  constructor(
    private http: HttpClient,
    private authService: AuthenticationService,
    @Inject(AGENT_STREAM_TRANSPORT) private streamTransport: AgentStreamTransport
  ) {}

  init(options: AgentChatOptions = {}): Promise<AgentInitResponse> {
    const mode = this.mode(options);
    const context = this.contextRefs(options);
    if (mode === 'integrated' && context.length === 0) {
      throw new Error('Integrated chat requires a problem, proposal, or scenario context.');
    }

    const formData = new FormData();
    formData.append('user_lang', options.language ?? 'Italiano');
    formData.append('integrated_mode', mode === 'integrated' ? 'true' : 'false');
    context.forEach(value => formData.append('context[]', value));

    return firstValueFrom(
      this.http.post<AgentInitResponse>(`${this.apiUrl}/init`, formData, this.requestOptions())
    ).then(response => {
      if (!response.session_id) {
        throw new Error('The agent did not return a session_id.');
      }
      this.saveSessionId(mode, response.session_id);
      this.lastContextByMode[mode] = context;
      return response;
    });
  }

  async sendMessage(
    message: string,
    options: AgentChatOptions = {},
    onProgress?: (message: string) => void
  ): Promise<AgentResponse> {
    const mode = this.mode(options);
    await this.ensureSession(options);

    const context = this.contextRefs(options);
    const previousContext = this.lastContextByMode[mode];
    const changedContext =
      mode === 'integrated' && previousContext && !this.sameContext(previousContext, context)
        ? context
        : null;
    if (changedContext) this.lastContextByMode[mode] = context;

    const sessionId = this.loadSessionId(mode);
    if (!sessionId) throw new Error('Unable to initialize the agent session.');

    const idempotencyKey = crypto.randomUUID();
    const formData = new FormData();
    formData.append('message', message);
    formData.append('session_id', sessionId);
    changedContext?.forEach(value => formData.append('context[]', value));

    let turnId: string;
    try {
      turnId = await this.postMessage(formData, idempotencyKey);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.clearSession(mode);
        await this.init(options);
        throw new AgentSessionUnavailableError();
      }
      if (error instanceof HttpErrorResponse && error.status === 409) {
        const activeTurnId = error.error?.detail?.active_turn_id;
        if (typeof activeTurnId === 'string' && activeTurnId.length > 0) {
          turnId = activeTurnId;
        } else {
          throw new Error('The agent reported an active turn without a turn_id.');
        }
      } else {
        throw error;
      }
    }

    return this.followTurn(turnId, onProgress);
  }

  async resumeIfRunning(
    options: AgentChatOptions = {},
    onProgress?: (message: string) => void
  ): Promise<AgentResponse | null> {
    const mode = this.mode(options);
    const sessionId = this.loadSessionId(mode);
    if (!sessionId) return null;

    this.lastContextByMode[mode] = this.contextRefs(options);
    let session: AgentSessionResponse;
    try {
      session = await firstValueFrom(
        this.http.get<AgentSessionResponse>(
          `${this.apiUrl}/session/${encodeURIComponent(sessionId)}`,
          this.requestOptions()
        )
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.clearSession(mode);
        return null;
      }
      throw error;
    }

    return session.active_turn_id
      ? this.followTurn(session.active_turn_id, onProgress)
      : null;
  }

  async reset(options: AgentChatOptions = {}): Promise<AgentInitResponse> {
    const mode = this.mode(options);
    const sessionId = this.loadSessionId(mode);
    if (sessionId) {
      const formData = new FormData();
      formData.append('session_id', sessionId);
      try {
        await firstValueFrom(
          this.http.post(`${this.apiUrl}/reset`, formData, this.requestOptions())
        );
      } catch (error) {
        if (!(error instanceof HttpErrorResponse && error.status === 404)) throw error;
      }
    }
    this.clearSession(mode);
    return this.init(options);
  }

  getSummary(scenarioIds: string[], sessionId?: string, evaluationId?: string): Observable<any> {
    const body: any = sessionId && evaluationId
      ? {
        key: 'summary',
        current_context: {
          temp: {
            creation_session: sessionId,
            evaluation_id: evaluationId,
          }
        },
      }
      : {
        key: 'summary',
        current_context: {
          scenarios: scenarioIds
        }
      };

    return this.http.post(`${this.apiUrl}/tool`, body, {
      params: this.getTerritoryParams(),
      withCredentials: true
    });
  }

  getUsageStats(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/usage_stats`, { withCredentials: true });
  }

  submitFeedback(
    messageIndex: number,
    vote?: string | null,
    comment?: string,
    mode: AgentChatMode = 'standalone'
  ): Observable<any> {
    const sessionId = this.loadSessionId(mode);
    if (!sessionId) {
      throw new Error('Cannot submit feedback without an active chat session.');
    }
    const params: Record<string, string | number> = {
      session_id: sessionId,
      message_index: messageIndex
    };
    if (vote) params['vote'] = vote;
    if (comment) params['comment'] = comment;
    return this.http.post(`${this.apiUrl}/feedback`, null, {
      params,
      withCredentials: true
    });
  }

  private async ensureSession(options: AgentChatOptions): Promise<void> {
    const mode = this.mode(options);
    if (this.loadSessionId(mode)) {
      if (!this.lastContextByMode[mode]) {
        this.lastContextByMode[mode] = this.contextRefs(options);
      }
      return;
    }
    await this.init(options);
  }

  private async postMessage(formData: FormData, idempotencyKey: string): Promise<string> {
    for (let retry = 0; retry <= 3; retry++) {
      try {
        const response = await firstValueFrom(
          this.http.post<AgentTurnResponse>(this.apiUrl, formData, {
            ...this.requestOptions(),
            headers: this.authHeaders().set('Idempotency-Key', idempotencyKey)
          })
        );
        if (!response.turn_id) throw new Error('The agent did not return a turn_id.');
        return response.turn_id;
      } catch (error) {
        const isRetryable =
          error instanceof TimeoutError ||
          (error instanceof HttpErrorResponse && error.status === 0);
        if (!isRetryable || retry === 3) throw error;
        await this.delay(250 * (2 ** retry));
      }
    }
    throw new Error('The agent message could not be submitted.');
  }

  private async followTurn(
    turnId: string,
    onProgress?: (message: string) => void
  ): Promise<AgentResponse> {
    const streamStartedAt = Date.now();
    let failures = 0;
    let lastEventId: string | null = null;

    while (failures < 3 && Date.now() - streamStartedAt < this.streamTimeoutMs) {
      const remaining = this.streamTimeoutMs - (Date.now() - streamStartedAt);
      const connection = this.streamTransport.connect(
        `${this.apiUrl}/turns/${encodeURIComponent(turnId)}/events`,
        this.authService.accessToken,
        lastEventId,
        id => { lastEventId = id; },
        message => onProgress?.(message)
      );
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const outcome = await Promise.race([
        connection.completion,
        new Promise<AgentStreamOutcome>(resolve => {
          timeoutId = setTimeout(() => resolve({ kind: 'failed' }), remaining);
        })
      ]);
      if (timeoutId) clearTimeout(timeoutId);
      connection.close();
      if (outcome.kind === 'done') break;
      failures++;
      if (failures < 3 && Date.now() - streamStartedAt < this.streamTimeoutMs) {
        await this.delay(300 * failures);
      }
    }

    return this.pollTurn(turnId);
  }

  private async pollTurn(turnId: string): Promise<AgentResponse> {
    const deadline = Date.now() + this.pollTimeoutMs;
    while (true) {
      const turn = await firstValueFrom(
        this.http.get<AgentTurnResult>(
          `${this.apiUrl}/turns/${encodeURIComponent(turnId)}`,
          this.requestOptions()
        )
      );
      if (turn.status !== 'running') {
        if (!turn.result || typeof turn.result.response !== 'string') {
          throw new Error(`The agent turn completed with status "${turn.status}" but no response.`);
        }
        return turn.result;
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new Error('The agent did not finish within six minutes.');
      }
      await this.delay(Math.min(this.pollIntervalMs, remaining));
    }
  }

  private mode(options: AgentChatOptions): AgentChatMode {
    return options.mode ?? 'standalone';
  }

  private contextRefs(options: AgentChatOptions): string[] {
    if (this.mode(options) !== 'integrated') return [];
    const context = options.context ?? {};
    const refs: string[] = [];
    if (context.problem_id) refs.push(`problem:${context.problem_id}`);
    if (context.proposal_id) refs.push(`proposal:${context.proposal_id}`);
    for (const id of context.scenario_ids ?? []) refs.push(`scenario:${id}`);
    return refs;
  }

  private sameContext(left: string[], right: string[]): boolean {
    return left.length === right.length && left.every((item, index) => item === right[index]);
  }

  private loadSessionId(mode: AgentChatMode): string | null {
    return localStorage.getItem(this.sessionStorageKeys[mode]);
  }

  private saveSessionId(mode: AgentChatMode, sessionId: string): void {
    localStorage.setItem(this.sessionStorageKeys[mode], sessionId);
  }

  private clearSession(mode: AgentChatMode): void {
    localStorage.removeItem(this.sessionStorageKeys[mode]);
    delete this.lastContextByMode[mode];
  }

  private requestOptions() {
    return {
      headers: this.authHeaders(),
      withCredentials: true,
      context: new HttpContext()
        .set(CUSTOM_TIMEOUT, this.requestTimeoutMs)
        .set(SKIP_ERROR_NOTIFICATION, true)
    };
  }

  private authHeaders() {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.accessToken}`
    });
  }

  private getTerritoryParams(): HttpParams {
    let params = new HttpParams();
    const territory = this.authService.activeTerritory;
    if (territory) params = params.set('territory', territory);
    return params;
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }
}

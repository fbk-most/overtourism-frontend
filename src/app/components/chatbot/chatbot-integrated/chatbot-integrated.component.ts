import {
  AfterViewChecked,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { marked } from 'marked';
import { firstValueFrom, Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { AgentChatContext, AgentService, AgentSessionUnavailableError } from '../../../services/agent.service';
import { ChatbotService } from '../../../services/chatbot/chatbot.service';
import { PageContextSyncService } from '../../../services/chatbot/page-context-sync.service';
import { ChatbotContextService } from '../../../services/chatbot/chatbotContext.service';
import { ChatbotActionTranslatorService } from '../../../services/chatbot/chatbot-action-translator.service';
import { ChatbotActionService } from '../../../services/chatbot/chatbotAction.service';
import { ChatMockService } from '../../../services/chatbot/chat-mock.service';
import {
  containsInternalChatMarkdownLink,
  navigateInternalChatLink
} from '../../../services/chatbot/chatbot-link-navigation';
import { AgentResponse, AgentType, ChatFeedback, ChatMessage } from '../../../models/chat.model';
import { ChatFeedbackBarComponent } from '../chatbot-standalone/chat-feedback-bar/chat-feedback-bar.component';
import { AuthenticationService } from '../../../services/authentication.service';
import { AGENT_TYPE_MAP, type AgentTypeMeta } from '../chatbot-standalone/chat-message/chat-message.component';
import { ItIconComponent } from 'design-angular-kit';

/** Shown (and kept in the history) when the server no longer has the conversation the history belongs to. */
const SESSION_LOST_NOTICE =
  'Conversazione precedente non più disponibile sul server: l’assistente riparte da zero, senza memoria dei messaggi sopra. Se serve, reinvia l’ultima domanda.';

const GREETING = 'Ciao! Come posso aiutarti?';
const OPEN_STATE_KEY = 'integrated_chatbot_open';

@Component({
  selector: 'app-chatbot-integrated',
  standalone: true,
  imports: [CommonModule, FormsModule, ChatFeedbackBarComponent, ItIconComponent],
  templateUrl: './chatbot-integrated.component.html',
  styleUrls: ['./chatbot-integrated.component.scss']
})
export class ChatbotIntegratedComponent implements OnInit, AfterViewChecked, OnDestroy {
  private translator = inject(ChatbotActionTranslatorService);
  private actionService = inject(ChatbotActionService);
  private mockService = inject(ChatMockService);
  private contextService = inject(ChatbotContextService);
  private router = inject(Router);
  private authService = inject(AuthenticationService);
  private pageSync = inject(PageContextSyncService);
  private pageChangesSub?: Subscription;
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  isOpen = false;
  isTyping = false;
  isResetting = false;
  inputText = '';
  statusMessage = '';
  private shouldScrollToBottom = false;

  messages: ChatMessage[] = [];
  feedbacks: Record<number, ChatFeedback> = {};

  showFeedbackModal = false;
  modalMsgIndex = -1;
  modalDraft = '';
  language = 'Italian';

  constructor(private agentSvc: AgentService, private chatbotSvc: ChatbotService) {}

  ngOnInit(): void {
    // The window state and the history survive a page refresh: nothing here wipes them.
    this.isOpen = this.readOpenState();
    const cached = this.chatbotSvc.loadMessages('integrated');
    if (cached.length > 0) {
      this.messages = cached;
      // History without a live backend session (e.g. the session id was dropped): keep showing it,
      // say once that the assistant has lost the thread, and let the next message open a new session.
      if (!this.agentSvc.hasSession('integrated') && this.hasUserMessages()) this.pushSessionLostNotice();
      this.triggerScroll();
    } else {
      this.pushBot(GREETING, 'operative');
    }

    // Page changes (navigation, filters, tabs...) are drawn in the conversation. Local only.
    this.pageChangesSub = this.pageSync.changes$.subscribe(change => this.pushPageEvent(change.text));

    this.isTyping = true;
    void this.agentSvc.resumeIfRunning(this.agentOptions(), message => {
      this.statusMessage = message;
    }).then(response => {
      if (response) this.handleAgentResponse(response);
    }).catch(error => {
      if (error instanceof AgentSessionUnavailableError) {
        this.discardUnrecoverableConversation();
        return;
      }
      console.error('Errore durante il ripristino della chat integrata:', error);
      this.pushBot('Impossibile ripristinare la risposta in corso. Riprova.');
    }).finally(() => {
      this.isTyping = false;
      this.statusMessage = '';
    });
  }

  ngOnDestroy(): void {
    this.pageChangesSub?.unsubscribe();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer?.nativeElement) {
        const element = this.scrollContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (error) {
      console.error('Errore nello scorrimento della chat:', error);
    }
  }

  private triggerScroll(): void {
    this.shouldScrollToBottom = true;
  }

  private pushBot(text: string, agentType?: AgentType): void {
    const index = this.messages.length - 1;
    this.messages.push({
      role: 'assistant',
      content: text,
      agentType,
      html: this.parseMarkdown(text),
      index
    });
    this.triggerScroll();
    this.persist();
  }

  private persist(): void {
    this.chatbotSvc.saveMessages(this.messages, 'integrated');
  }

  /** Local-only line in the history (not a message: it never reaches the backend). */
  private pushEvent(text: string): void {
    const last = this.messages[this.messages.length - 1];
    if (last?.role === 'event' && last.content === text) return;
    this.messages.push({ role: 'event', content: text });
    this.triggerScroll();
    this.persist();
  }

  private pushPageEvent(text: string): void {
    this.pushEvent(text);
  }

  private hasUserMessages(): boolean {
    return this.messages.some(message => message.role === 'user');
  }

  private pushSessionLostNotice(): void {
    const last = this.messages[this.messages.length - 1];
    if (last?.role === 'event' && last.content === SESSION_LOST_NOTICE) return;
    this.pushEvent(SESSION_LOST_NOTICE);
  }

  /**
   * The conversation no longer exists in the backend. The history stays visible (a refresh or a
   * server restart must not erase what the user was reading); we only tell the user.
   */
  private discardUnrecoverableConversation(): void {
    this.pushSessionLostNotice();
  }

  private readOpenState(): boolean {
    try {
      return sessionStorage.getItem(OPEN_STATE_KEY) === '1';
    } catch {
      return false;
    }
  }

  private storeOpenState(): void {
    try {
      sessionStorage.setItem(OPEN_STATE_KEY, this.isOpen ? '1' : '0');
    } catch {
      /* storage unavailable: the window just starts closed after a refresh */
    }
  }

  /** Starts a fresh conversation: new backend session, empty history, greeting only. */
  async startNewChat(): Promise<void> {
    if (this.isTyping || this.isResetting) return;
    this.isResetting = true;
    this.isTyping = true;
    this.statusMessage = '';
    try {
      await this.agentSvc.reset(this.agentOptions());
      this.chatbotSvc.clearMessages('integrated');
      this.feedbacks = {};
      this.messages = [];
      this.inputText = '';
      this.pushBot(GREETING, 'operative');
    } catch (error) {
      console.error('Errore durante il reset della chat integrata:', error);
      this.pushBot('Impossibile iniziare una nuova chat. Riprova.');
    } finally {
      this.isTyping = false;
      this.isResetting = false;
    }
  }

  getAgentMeta(agentType?: AgentType): AgentTypeMeta | null {
    return agentType ? AGENT_TYPE_MAP[agentType] ?? null : null;
  }

  private parseMarkdown(text: string): string {
    return marked.parse(text) as string;
  }

  private agentOptions() {
    const context = this.contextService.getPayloadContext();
    const agentContext: AgentChatContext = {
      problem_id: context.problem_id,
      proposal_id: context.proposal_id,
      scenario_ids: context.scenario_ids
    };
    return { mode: 'integrated' as const, language: this.language, context: agentContext };
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    this.storeOpenState();
    if (this.isOpen) this.triggerScroll();
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  handleAssistantLinkClick(event: MouseEvent): void {
    navigateInternalChatLink(event, this.router, this.authService);
  }

  private handleAgentResponse(data: AgentResponse): void {
    if (data.territory) {
      this.authService.setActiveTerritory(data.territory, false, false);
    }
    this.pushBot(data.response ?? 'Nessuna risposta.', data.agent_type);
    if (data.assistant_action_data?.length) {
      const actions = data.assistant_action_data
        .flatMap(event => this.translator.translateForIntegrated(event))
        .filter(action => !(action.type === 'NAVIGATE' && containsInternalChatMarkdownLink(data.response ?? '')));
      actions.forEach(action => this.actionService.execute(action));
    }
  }

  async send(): Promise<void> {
    const text = this.inputText.trim();
    if (!text || this.isTyping) return;

    // A page change the user just made is drawn (synchronously) before their message, and the backend
    // gets the page exactly as it is now before it reads the message.
    const pageSynced = this.pageSync.flush().catch(() => undefined);

    this.messages.push({ role: 'user', content: text });
    this.persist();
    this.inputText = '';
    this.isTyping = true;
    this.statusMessage = '';
    this.triggerScroll();

    const mock = this.mockService.find(text);
    if (mock) {
      await new Promise(resolve => setTimeout(resolve, 800));
      this.handleAgentResponse(mock);
      this.isTyping = false;
      return;
    }

    try {
      await pageSynced;
      const response = await this.agentSvc.sendMessage(
        text,
        this.agentOptions(),
        message => {
          this.statusMessage = message;
        }
      );
      this.handleAgentResponse(response);
    } catch (error) {
      if (error instanceof AgentSessionUnavailableError) {
        this.discardUnrecoverableConversation();
        return;
      }
      console.error('Errore durante l’invio del messaggio integrato:', error);
      this.pushBot('Si è verificato un problema. Riprova a inviare il messaggio.');
    } finally {
      this.isTyping = false;
      this.statusMessage = '';
    }
  }

  /**
   * Position of a message in the backend conversation: the local greeting and the local-only event
   * lines are not part of it, so they must not shift the index used for feedback.
   */
  private backendMessageIndex(index: number): number {
    let position = 0;
    for (let i = 0; i < index; i++) {
      const message = this.messages[i];
      if (message.role === 'event' || (i === 0 && message.role === 'assistant')) continue;
      position++;
    }
    return position;
  }

  getFeedback(index: number): ChatFeedback {
    return this.feedbacks[index] ?? {};
  }

  handleVote(index: number, vote: 'up' | 'down'): void {
    const current = this.getFeedback(index);
    this.feedbacks[index] = { ...current, vote };
    this.submitFeedback(index);
  }

  handleComment(index: number, comment: string): void {
    const current = this.getFeedback(index);
    this.feedbacks[index] = { ...this.getFeedback(index), comment };
    this.submitFeedback(index);
  }

  private async submitFeedback(index: number): Promise<void> {
    const feedback = this.getFeedback(index);
    try {
      await firstValueFrom(
        this.agentSvc.submitFeedback(this.backendMessageIndex(index), feedback.vote, feedback.comment, 'integrated')
      );
    } catch (error) {
      console.error('Failed to submit feedback', error);
    }
  }
}

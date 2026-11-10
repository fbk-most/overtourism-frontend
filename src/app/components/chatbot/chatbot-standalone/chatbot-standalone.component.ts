import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatMessageComponent } from './chat-message/chat-message.component';
import { DesignAngularKitModule } from 'design-angular-kit';
import { AgentService, AgentSessionUnavailableError } from '../../../services/agent.service';
import { ChatbotActionTranslatorService } from '../../../services/chatbot/chatbot-action-translator.service';
import { ChatMockService } from '../../../services/chatbot/chat-mock.service';
import { AgentRole, AgentResponse, ChatFeedback,ChatMessage, UIAction } from '../../../models/chat.model';
import { ChatbotService } from '../../../services/chatbot/chatbot.service';
import { AuthenticationService } from '../../../services/authentication.service';
import { AGENT_TYPE_MAP } from './chat-message/chat-message.component';
import { IconName } from 'design-angular-kit';
import { CHAT_WIDGET_REGISTRY } from '../chat-widget-registry';

interface AgentModeOption {
  value: AgentRole;
  label: string;
  icon: IconName;
}

@Component({
  selector: 'app-chatbot-standalone',
  standalone: true,
  imports: [CommonModule, FormsModule, ChatMessageComponent, DesignAngularKitModule,
  ],
    templateUrl: './chatbot-standalone.component.html',
  styleUrls: ['./chatbot-standalone.component.scss']
})
export class ChatbotStandaloneComponent implements OnInit, AfterViewChecked {
  readonly widgetRegistry = CHAT_WIDGET_REGISTRY;
  private translator = inject(ChatbotActionTranslatorService);
  private mockService = inject(ChatMockService);
  messages: ChatMessage[] = [];
  input = '';
  loading = false;
  activeContext = '-';
  statusMessage: string | null = null;
  feedbacks: Record<number, ChatFeedback> = {};
  readonly modeOptions: AgentModeOption[] = [
    { value: 'auto', label: 'Automatico', icon: 'comment' },
    { value: 'executor', ...AGENT_TYPE_MAP.executor },
    { value: 'operative', ...AGENT_TYPE_MAP.operative },
    { value: 'methodological', ...AGENT_TYPE_MAP.methodological },
    { value: 'exploitative', ...AGENT_TYPE_MAP.exploitative }
  ];
  selectedRole: AgentRole = 'auto';
  modeMenuOpen = false;

  @ViewChild('chatRef') chatRef!: ElementRef;
  @ViewChild('textareaRef') textareaRef!: ElementRef;

  private shouldScroll = false;


  constructor(
    private agentSvc: AgentService,
    private chatbotSvc: ChatbotService,
    private authService: AuthenticationService
  ) {
    const storedRole = localStorage.getItem('chatbot_force_role');
    this.selectedRole = this.modeOptions.find(option => option.value === storedRole)?.value ?? 'auto';
  }

  get canChangeMode(): boolean {
    return this.messages.length === 0 && !this.loading;
  }

  get selectedMode(): AgentModeOption {
    return this.modeOptions.find(option => option.value === this.selectedRole) ?? this.modeOptions[0];
  }

  get isViewer(): boolean {
    return this.authService.isViewer;
  }

  private normalizeViewerMode(): void {
    if (this.isViewer && (this.selectedRole === 'methodological' || this.selectedRole === 'exploitative')) {
      this.selectedRole = 'auto';
      localStorage.setItem('chatbot_force_role', this.selectedRole);
    }
  }

  toggleModeMenu(): void {
    if (this.canChangeMode) this.modeMenuOpen = !this.modeMenuOpen;
  }

  selectMode(role: AgentRole): void {
    if (!this.canChangeMode || (this.isViewer && (role === 'methodological' || role === 'exploitative'))) {
      return;
    }

    this.selectedRole = role;
    localStorage.setItem('chatbot_force_role', role);
    this.modeMenuOpen = false;
  }

  async startNewChat(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.modeMenuOpen = false;
    try {
      await this.agentSvc.reset({ language: 'Italiano' });
      this.chatbotSvc.clearMessages();
      this.messages = [];
      this.feedbacks = {};
      this.input = '';
      this.statusMessage = null;
      this.activeContext = '-';
      this.selectedRole = 'auto';
      localStorage.setItem('chatbot_force_role', this.selectedRole);
    } catch (error) {
      console.error('Errore durante il reset della chat:', error);
      this.messages = [
        ...this.messages,
        { role: 'assistant', content: 'Impossibile iniziare una nuova chat. Riprova.' }
      ];
      this.saveMessages(this.messages);
    } finally {
      this.loading = false;
    }
  }
  ngOnInit(): void {
    this.messages = this.chatbotSvc.loadMessages();
    if (this.messages.length === 0) this.normalizeViewerMode();
    if (this.messages.length > 0) this.shouldScroll = true;
    this.loading = true;
    void this.agentSvc.resumeIfRunning(
      { language: 'Italiano' },
      message => {
        this.statusMessage = message;
        this.shouldScroll = true;
      }
    ).then(async response => {
      if (response) {
        await this.handleAgentResponse(this.messages, response);
      }
    }).catch(error => {
      console.error('Errore durante il ripristino della chat:', error);
      this.messages = [
        ...this.messages,
        { role: 'assistant', content: 'Impossibile ripristinare la risposta in corso. Riprova.' }
      ];
      this.saveMessages(this.messages);
    }).finally(() => {
      this.loading = false;
      this.statusMessage = null;
      this.shouldScroll = true;
    });
  }
  ngAfterViewChecked() {
    if (this.shouldScroll && this.chatRef) {
      this.chatRef.nativeElement.scrollTop = this.chatRef.nativeElement.scrollHeight;
      this.shouldScroll = false;
    }
  }

  onInputChange(event: Event) {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 24)}px`;
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

    /** Salva i messaggi nel localStorage ogni volta che cambiano */
    private saveMessages(msgs: ChatMessage[]): void {
      this.chatbotSvc.saveMessages(msgs);    }

    /** Gestisce risposta: traduce DomainEvents in UIActions inline */
  private async handleAgentResponse(currentMessages: ChatMessage[], data: AgentResponse): Promise<void> {
    if (data.territory) {
      this.authService.setActiveTerritory(data.territory, false, false);
    }

    const rawEvents = data.assistant_action_data || [];
    const translatedArrays = rawEvents.length
      ? await Promise.all(rawEvents.map(e => this.translator.translateForStandalone(e)))
      : [];

    const inlineActions: UIAction[] = translatedArrays
      .flat()
      .filter(a => a.type === 'SHOW_WIDGET');


    const updated: ChatMessage[] = [...currentMessages, {
      role: 'assistant',
      content: data.response,
      agentType: data.agent_type,
      chartData: data.chart_data ?? null,
      inlineActions: inlineActions.length > 0 ? inlineActions : undefined
    }];

    this.messages = updated;
    this.saveMessages(updated);  
  }
  async sendMessage(): Promise<void> {
    if (!this.input.trim()) return;

    const currentInput = this.input;
    const newMessages: ChatMessage[] = [...this.messages, { role: 'user', content: currentInput }];
    this.messages = newMessages;
    this.saveMessages(newMessages);
    this.input = '';
    if (this.textareaRef) this.textareaRef.nativeElement.style.height = 'auto';
    this.loading = true;
    this.statusMessage = '';
    this.shouldScroll = true;

    const mock = this.mockService.find(currentInput);
    if (mock) {
      setTimeout(() => {
        this.handleAgentResponse(newMessages, mock);
        this.loading = false;
      }, 800);
      return;
    }

    try {
      const response = await this.agentSvc.sendMessage(
        currentInput,
        { language: 'Italiano', force_role: this.selectedRole },
        message => {
          this.statusMessage = message;
          this.shouldScroll = true;
        }
      );
      await this.handleAgentResponse(newMessages, response);
    } catch (error) {
      console.error('Errore durante l’invio del messaggio:', error);
      const content = error instanceof AgentSessionUnavailableError
        ? 'La sessione non è più disponibile. Invia di nuovo il messaggio per continuare.'
        : '⚠️ Impossibile contattare il server. Verifica la connessione e riprova.';
      this.messages = [...newMessages, { role: 'assistant', content }];
      this.chatbotSvc.saveMessages(this.messages);
    } finally {
      this.loading = false;
      this.statusMessage = null;
      this.shouldScroll = true;
    }
  }

  onVote(index: number, vote: string | null) {
    const updated = { ...this.feedbacks[index], vote: vote as any };
    this.feedbacks = { ...this.feedbacks, [index]: updated };
    this.agentSvc.submitFeedback(index, vote || undefined, updated.comment).subscribe({
      error: error => console.error('Errore nell’invio del feedback:', error)
    });
  }

  onComment(index: number, comment: string) {
    const updated = { ...this.feedbacks[index], comment };
    this.feedbacks = { ...this.feedbacks, [index]: updated };
    this.agentSvc.submitFeedback(index, updated.vote || undefined, comment).subscribe({
      error: error => console.error('Errore nell’invio del feedback:', error)
    });
  }
}
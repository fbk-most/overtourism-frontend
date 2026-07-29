import { Component, Input, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { marked } from 'marked';
import { ChatbotContextService } from '../../../services/chatbot/chatbotContext.service';
import { SharedHistogramComponent } from '../../shared/shared-histogram/shared-histogram.component';
import { SharedKpisComponent } from '../../shared/shared-kpis/shared-kpis.component';
import { ChatbotActionTranslatorService } from '../../../services/chatbot/chatbot-action-translator.service';
import { ChatbotActionService } from '../../../services/chatbot/chatbotAction.service';
import { ChatMockService } from '../../../services/chatbot/chat-mock.service';
import { AgentResponse, ChatFeedback, ChatMessage } from '../../../models/chat.model';
import { ChatFeedbackBarComponent } from '../chatbot-standalone/chat-feedback-bar/chat-feedback-bar.component';
import { AgentService } from '../../../services/agent.service';
import { firstValueFrom } from 'rxjs';



@Component({
  selector: 'app-chatbot-integrated',
  standalone: true,
  imports: [CommonModule, FormsModule,ChatFeedbackBarComponent],
  templateUrl: './chatbot-integrated.component.html',
  styleUrls: ['./chatbot-integrated.component.scss']
})
export class ChatbotIntegratedComponent implements OnInit, OnDestroy {
  private translator = inject(ChatbotActionTranslatorService);
  private actionService = inject(ChatbotActionService);
  private mockService = inject(ChatMockService);
  private http = inject(HttpClient);
  private contextService = inject(ChatbotContextService);


  isOpen = false;
  isTyping = false;
  inputText = '';
  statusMessage = '';

  messages: ChatMessage[] = [];
  feedbacks: Record<number, ChatFeedback> = {};

  // Modal state
  showFeedbackModal = false;
  modalMsgIndex = -1;
  modalDraft = '';

  sessionId!: string;
  language = 'Italian';

  private eventSource: any = null;
  constructor(private agentSvc: AgentService) {}

  private parseMarkdown(text: string): string {
    return marked.parse(text) as string;
  }

  ngOnInit(): void {
    this.sessionId = this.generateSessionId();
    this.pushBot('Ciao! Come posso aiutarti?');
  }

  ngOnDestroy(): void {
    this.closeEventSource();
  }

  private generateSessionId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 8 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
  }

  private closeEventSource(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /** Push a bot message and assign it a stable index for feedback. */
  private pushBot(text: string): void {
    const index = this.messages.length - 1;
    this.messages.push({
      role: 'assistant',        
      content: text,           
      html: this.parseMarkdown(text),
      index
    });
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
  }
  private handleAgentResponse(data: AgentResponse): void {
    this.pushBot(data.response ?? 'Nessuna risposta.');

    if (data.events?.length) {
      data.events
        .flatMap(e => this.translator.translateForIntegrated(e))
        .forEach(action => this.actionService.execute(action));
    }
  }
  // ─── Send ──────────────────────────────────────────────────────────────────

  send(): void {
    const text = this.inputText.trim();
    if (!text || this.isTyping) return;

    this.messages.push({ role: 'user', content: text });
    this.inputText = '';
    this.isTyping = true;
    this.statusMessage = '';

    const mock = this.mockService.find(text);
    if (mock) {
      setTimeout(() => {
        this.handleAgentResponse(mock);
        this.isTyping = false;
      }, 800);
      return;
    }

    this.closeEventSource();

    const formData = new FormData();
    formData.append('message', text);
    formData.append('session_id', this.sessionId);
    formData.append('user_lang', this.language);

    const problemId = this.contextService.problemId$.getValue();
    const scenarios = this.contextService.scenarioIds$.getValue();
    if (problemId) formData.append('problem_id', problemId);
    if (scenarios.length) {
      formData.append('integrated_mode', 'true');
      scenarios.forEach(id => formData.append('context', id));
    }

    // 1. Prima POST, poi stream
    this.agentSvc.sendMessage(this.sessionId, text, this.language, []).subscribe({
      next: () => {
        // 2. Apri stream solo dopo che la sessione è registrata
        this.eventSource = this.agentSvc.createEventSource(this.sessionId);

        this.eventSource.addEventListener('status', (e: MessageEvent) => {
          this.statusMessage = e.data;
        });

        this.eventSource.addEventListener('done', async () => {
          this.closeEventSource();
          try {
            const data = await firstValueFrom(this.agentSvc.getResult(this.sessionId));
            if (data.session_id) this.sessionId = data.session_id;
            this.pushBot(data.response ?? 'No response received.');
          } catch {
            this.pushBot('Error fetching result.');
          }
          this.isTyping = false;
          this.statusMessage = '';
        });

        this.eventSource.onerror = () => {
          this.closeEventSource();
          this.pushBot('Connection error. Please try again.');
          this.isTyping = false;
          this.statusMessage = '';
        };
      },
      error: () => {
        this.closeEventSource();
        this.pushBot('Sorry, something went wrong.');
        this.isTyping = false;
      }
    });
  }

  
  getFeedback(index: number): ChatFeedback {
    return this.feedbacks[index] ?? {};
  }

  handleVote(index: number, vote: 'up' | 'down'): void {
    const current = this.getFeedback(index);
    // Se non serve il toggle deseleziona, basta assegnare il nuovo voto
    this.feedbacks[index] = { ...current, vote };
    this.submitFeedback(index);
  }

  handleComment(index: number, comment: string): void {
    const current = this.getFeedback(index);
    this.feedbacks[index] = { ...current, comment };
    this.submitFeedback(index);
  }

  private async submitFeedback(index: number): Promise<void> {
    const fb = this.getFeedback(index);
    try {
      await firstValueFrom(this.agentSvc.submitFeedback(this.sessionId, index-1, fb.vote, fb.comment));
    } catch (err) {
      console.error('Failed to submit feedback', err);
    }
  }


   
}
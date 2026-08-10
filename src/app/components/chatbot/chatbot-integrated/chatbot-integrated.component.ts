import { Component, Input, OnInit, OnDestroy, inject, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
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
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;


  isOpen = false;
  isTyping = false;
  inputText = '';
  statusMessage = '';
  private shouldScrollToBottom = false;

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
  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer && this.scrollContainer.nativeElement) {
        const el = this.scrollContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    } catch (error) {
      // Ignora errori di scroll
    }
  }

  private triggerScroll(): void {
    this.shouldScrollToBottom = true;
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
    this.triggerScroll();

  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.triggerScroll();
    }
  }
  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); 
      this.send();
    }
  }
  private handleAgentResponse(data: AgentResponse): void {
    this.pushBot(data.response ?? 'Nessuna risposta.');

    if (data.assistant_action_data?.length) {
      data.assistant_action_data
        .flatMap(e => this.translator.translateForIntegrated(e))
        .forEach(action => this.actionService.execute(action));
    }
  }
  // ─── Send ──────────────────────────────────────────────────────────────────

  send(): void {
    if (!this.inputText.trim()) return;
    const text = this.inputText.trim();
    if (!text || this.isTyping) return;

    this.messages.push({ role: 'user', content: text });
    this.inputText = '';
    this.isTyping = true;
    this.statusMessage = '';
    this.triggerScroll();
    const mock = this.mockService.find(text);
    if (mock) {
      setTimeout(() => {
        this.handleAgentResponse(mock);
        this.isTyping = false;
        this.triggerScroll(); 
      }, 800);
      return;
    }

    this.closeEventSource();

    // const formData = new FormData();
    // formData.append('message', text);
    // formData.append('session_id', this.sessionId);
    // formData.append('user_lang', this.language);
    // formData.append('integrated_mode', 'true');

    // Manda IL CONTESTO COMPLETO
    if (!this.sessionId) {
      this.sessionId = this.agentSvc.generateSessionId();
    }

    // //  Estrai il contesto dal service
    // const ctx = this.contextService.getPayloadContext();
    
    // //  Crea il dizionario del contesto da passare al service
    // const contextData: Record<string, any> = {
    //   integrated_mode: 'true',
    //   route: ctx.route
    // };
    

    const ctx = this.contextService.getPayloadContext();

    const contextArray = [JSON.stringify(ctx)];
    this.agentSvc.sendMessage(this.sessionId, text, this.language, [], true, contextArray).subscribe({
      next: () => {
        // Apri stream solo dopo che la sessione è registrata
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
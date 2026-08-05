import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ChatMessageComponent } from './chat-message/chat-message.component';
import { DesignAngularKitModule } from 'design-angular-kit';
import { AgentService } from '../../../services/agent.service';
import { ChatbotActionTranslatorService } from '../../../services/chatbot/chatbot-action-translator.service';
import { ChatMockService } from '../../../services/chatbot/chat-mock.service';
import { AgentResponse, ChatFeedback,ChatMessage, UIAction } from '../../../models/chat.model';
import { SharedHistogramComponent } from '../../shared/shared-histogram/shared-histogram.component';
import { SharedKpisComponent } from '../../shared/shared-kpis/shared-kpis.component';
import { SharedPlotComponent } from '../../shared/shared-plot/shared-plot.component';
import { IndiciMapComponent } from '../../indici-map/indici-map.component';

@Component({
  selector: 'app-chatbot-standalone',
  standalone: true,
  imports: [CommonModule, FormsModule, ChatMessageComponent, DesignAngularKitModule,
    // @ts-ignore-warnings
    SharedHistogramComponent, SharedKpisComponent,SharedPlotComponent],
    templateUrl: './chatbot-standalone.component.html',
  styleUrls: ['./chatbot-standalone.component.scss']
})
export class ChatbotStandaloneComponent implements OnInit, AfterViewChecked {
  readonly widgetRegistry: Record<string, any> = {
    'histogramComparison': SharedHistogramComponent,
    'indexComparison': SharedKpisComponent,
    'plot': SharedPlotComponent, 
    'map': IndiciMapComponent 

  };
  private translator = inject(ChatbotActionTranslatorService);
  private mockService = inject(ChatMockService);
  messages: ChatMessage[] = [];
  input = '';
  loading = false;
  attachments: File[] = [];
  activeContext = '-';
  statusMessage: string | null = null;
  feedbacks: Record<number, ChatFeedback> = {};
  sessionId: string;

  @ViewChild('chatRef') chatRef!: ElementRef;
  @ViewChild('textareaRef') textareaRef!: ElementRef;
  @ViewChild('fileInputRef') fileInputRef!: ElementRef;

  private shouldScroll = false;

  constructor(private agentSvc: AgentService) {
    this.sessionId = this.agentSvc.generateSessionId();
  }

  ngOnInit() {}

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

  onFileChange(event: Event) {
    const files = Array.from((event.target as HTMLInputElement).files || []);
    const existing = new Set(this.attachments.map(f => f.name));
    this.attachments = [...this.attachments, ...files.filter(f => !existing.has(f.name))];
    (event.target as HTMLInputElement).value = '';
  }

  removeAttachment(idx: number) {
    this.attachments = this.attachments.filter((_, i) => i !== idx);
  }
  /** Gestisce risposta: traduce DomainEvents in UIActions inline */
  private handleAgentResponse(currentMessages: ChatMessage[], data: AgentResponse): void {
    const rawEvents = data.assistant_action_data || data.assistant_action_data || [];
    const inlineActions: UIAction[] = rawEvents.length
      ? rawEvents.flatMap(e => this.translator.translateForStandalone(e))
                   .filter(a => a.type === 'SHOW_WIDGET')
      : [];

    this.messages = [...currentMessages, {
      role: 'assistant',
      content: data.response,
      chartData: data.chart_data ?? null,
      slidersData: data.sliders_data ?? null,
      inlineActions: inlineActions.length > 0 ? inlineActions : undefined
    }];
  }
  async sendMessage() {
    if (!this.input.trim() && this.attachments.length === 0) return;

    const currentInput = this.input;
    const newMessages: ChatMessage[] = [...this.messages, { role: 'user', content: currentInput || '[Attachment]' }];
    this.messages = newMessages;
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

    const files = [...this.attachments];
    this.attachments = [];
    if (this.fileInputRef) this.fileInputRef.nativeElement.value = '';

    this.agentSvc.sendMessage(this.sessionId, currentInput, 'Italiano', files).subscribe({
      next: () => {
        const eventSource = this.agentSvc.createEventSource(this.sessionId);

        eventSource.addEventListener('status', (e: MessageEvent) => {
          this.statusMessage = e.data;
          this.shouldScroll = true;
        });

        eventSource.addEventListener('done', async () => {
          eventSource.close();
          try {
            const data = await firstValueFrom(this.agentSvc.getResult(this.sessionId));
            this.activeContext = data.active_context || '-';
            this.handleAgentResponse(newMessages, data);
          } catch {
            this.messages = [...newMessages, { role: 'assistant', content: 'Errore nel recuperare la risposta.' }];
          }
          this.loading = false;
          this.statusMessage = null;
          this.shouldScroll = true;
        });

        eventSource.onerror = () => {
          eventSource.close();
          this.loading = false;
          this.statusMessage = null;
        };
      },
      error: () => {
        this.messages = [...newMessages, { role: 'assistant', content: 'Errore nel contattare il server.' }];
        this.loading = false;
      }
    });
  }

  onSliderSubmit(sessionId: string) {
    this.loading = true;
    this.statusMessage = '';
    const currentMessages = [...this.messages];

    const eventSource = this.agentSvc.createEventSource(sessionId);
    const timeout = setTimeout(() => {
      eventSource.close();
      this.loading = false;
      this.statusMessage = null;
    }, 30000);

    eventSource.addEventListener('status', (e: MessageEvent) => { this.statusMessage = e.data; });

    eventSource.addEventListener('done', async () => {
      clearTimeout(timeout);
      eventSource.close();
      try {
        const data = await firstValueFrom(this.agentSvc.getResult(sessionId));
        this.activeContext = data.active_context || '-';
        this.handleAgentResponse(currentMessages, data);
      } catch {
        this.messages = [...currentMessages, { role: 'assistant', content: 'Errore nel recuperare la risposta.' }];
      }
      this.loading = false;
      this.statusMessage = null;
      this.shouldScroll = true;
    });

    eventSource.onerror = () => {
      clearTimeout(timeout);
      eventSource.close();
      this.loading = false;
      this.statusMessage = null;
    };
  }

  onVote(index: number, vote: string | null) {
    const updated = { ...this.feedbacks[index], vote: vote as any };
    this.feedbacks = { ...this.feedbacks, [index]: updated };
    this.agentSvc.submitFeedback(this.sessionId, index, vote || undefined, updated.comment).subscribe();
  }

  onComment(index: number, comment: string) {
    const updated = { ...this.feedbacks[index], comment };
    this.feedbacks = { ...this.feedbacks, [index]: updated };
    this.agentSvc.submitFeedback(this.sessionId, index, updated.vote || undefined, comment).subscribe();
  }
}
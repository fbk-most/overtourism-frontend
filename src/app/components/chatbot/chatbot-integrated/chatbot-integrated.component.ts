import {
  AfterViewChecked,
  Component,
  ElementRef,
  inject,
  OnInit,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { marked } from 'marked';
import { firstValueFrom } from 'rxjs';
import { AgentChatContext, AgentService } from '../../../services/agent.service';
import { ChatbotContextService } from '../../../services/chatbot/chatbotContext.service';
import { ChatbotActionTranslatorService } from '../../../services/chatbot/chatbot-action-translator.service';
import { ChatbotActionService } from '../../../services/chatbot/chatbotAction.service';
import { ChatMockService } from '../../../services/chatbot/chat-mock.service';
import { AgentResponse, ChatFeedback, ChatMessage } from '../../../models/chat.model';
import { ChatFeedbackBarComponent } from '../chatbot-standalone/chat-feedback-bar/chat-feedback-bar.component';

@Component({
  selector: 'app-chatbot-integrated',
  standalone: true,
  imports: [CommonModule, FormsModule, ChatFeedbackBarComponent],
  templateUrl: './chatbot-integrated.component.html',
  styleUrls: ['./chatbot-integrated.component.scss']
})
export class ChatbotIntegratedComponent implements OnInit, AfterViewChecked {
  private translator = inject(ChatbotActionTranslatorService);
  private actionService = inject(ChatbotActionService);
  private mockService = inject(ChatMockService);
  private contextService = inject(ChatbotContextService);
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  isOpen = false;
  isTyping = false;
  inputText = '';
  statusMessage = '';
  private shouldScrollToBottom = false;

  messages: ChatMessage[] = [];
  feedbacks: Record<number, ChatFeedback> = {};

  showFeedbackModal = false;
  modalMsgIndex = -1;
  modalDraft = '';
  language = 'Italian';

  constructor(private agentSvc: AgentService) {}

  ngOnInit(): void {
    this.pushBot('Ciao! Come posso aiutarti?');
    this.isTyping = true;
    void this.agentSvc.resumeIfRunning(this.agentOptions(), message => {
      this.statusMessage = message;
    }).then(response => {
      if (response) this.handleAgentResponse(response);
    }).catch(error => {
      console.error('Errore durante il ripristino della chat integrata:', error);
      this.pushBot('Impossibile ripristinare la risposta in corso. Riprova.');
    }).finally(() => {
      this.isTyping = false;
      this.statusMessage = '';
    });
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
    if (this.isOpen) this.triggerScroll();
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  private handleAgentResponse(data: AgentResponse): void {
    this.pushBot(data.response ?? 'Nessuna risposta.');
    if (data.assistant_action_data?.length) {
      data.assistant_action_data
        .flatMap(event => this.translator.translateForIntegrated(event))
        .forEach(action => this.actionService.execute(action));
    }
  }

  async send(): Promise<void> {
    const text = this.inputText.trim();
    if (!text || this.isTyping) return;

    this.messages.push({ role: 'user', content: text });
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
      const response = await this.agentSvc.sendMessage(
        text,
        this.agentOptions(),
        message => {
          this.statusMessage = message;
        }
      );
      this.handleAgentResponse(response);
    } catch (error) {
      console.error('Errore durante l’invio del messaggio integrato:', error);
      this.pushBot('Si è verificato un problema. Riprova a inviare il messaggio.');
    } finally {
      this.isTyping = false;
      this.statusMessage = '';
    }
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
        this.agentSvc.submitFeedback(index - 1, feedback.vote, feedback.comment, 'integrated')
      );
    } catch (error) {
      console.error('Failed to submit feedback', error);
    }
  }
}

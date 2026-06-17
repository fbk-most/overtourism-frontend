import { Component, Input, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { marked } from 'marked';

interface Feedback {
  vote?: 'up' | 'down' | null;
  comment?: string;
}

interface Message {
  sender: 'user' | 'bot';
  text: string;
  html?: string;
  index?: number; // assigned when pushed, for feedback keying
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.scss']
})
export class ChatbotComponent implements OnInit, OnDestroy {

  private http = inject(HttpClient);

  @Input() scenarioId1!: string;
  @Input() scenarioId2!: string;
  @Input() problemId!: string;

  isOpen = false;
  isTyping = false;
  inputText = '';
  statusMessage = '';

  messages: Message[] = [];
  feedbacks: Record<number, Feedback> = {};

  // Modal state
  showFeedbackModal = false;
  modalMsgIndex = -1;
  modalDraft = '';

  sessionId!: string;
  language = 'Italian';

  private readonly API_URL = 'http://localhost:9000/agent';
  private eventSource: EventSource | null = null;

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
    const index = this.messages.length -1;
    this.messages.push({
      sender: 'bot',
      text,
      html: this.parseMarkdown(text),
      index,
    });
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
  }

  // ─── Send ──────────────────────────────────────────────────────────────────

  send(): void {
    const text = this.inputText.trim();
    if (!text || this.isTyping) return;

    this.messages.push({ sender: 'user', text });
    this.inputText = '';
    this.isTyping = true;
    this.statusMessage = '';

    this.closeEventSource();
    this.eventSource = new EventSource(`${this.API_URL}/stream/${this.sessionId}`);

    this.eventSource.addEventListener('status', (e: MessageEvent) => {
      this.statusMessage = e.data;
    });

    this.eventSource.addEventListener('done', async () => {
      this.closeEventSource();
      try {
        const data = await fetch(`${this.API_URL}/result/${this.sessionId}`)
          .then(res => res.json());

        if (data.session_id) this.sessionId = data.session_id;
        this.pushBot(data.response ?? 'No response received.');
      } catch {
        this.pushBot('Error fetching result.');
      }
      this.isTyping = false;
      this.statusMessage = '';
      this.saveConversation();
    });

    this.eventSource.onerror = () => {
      this.closeEventSource();
      this.pushBot('Connection error. Please try again.');
      this.isTyping = false;
      this.statusMessage = '';
    };

    const formData = new FormData();
    formData.append('message', text);
    formData.append('session_id', this.sessionId);
    formData.append('user_lang', this.language);

    const validScenarioIds = [this.scenarioId1, this.scenarioId2].filter(
      id => typeof id === 'string' && id.trim().length > 0
    );
    if (validScenarioIds.length > 0) {
      formData.append('integrated_mode', 'true');
      validScenarioIds.forEach(id => formData.append('context', id));
    }

    this.http.post(this.API_URL, formData).subscribe({
      error: () => {
        this.closeEventSource();
        this.pushBot('Sorry, something went wrong.');
        this.isTyping = false;
        this.statusMessage = '';
      }
    });
  }

  // ─── Feedback ──────────────────────────────────────────────────────────────

  getFeedback(index: number): Feedback {
    return this.feedbacks[index] ?? {};
  }

  handleVote(index: number, vote: 'up' | 'down'): void {
    const current = this.getFeedback(index);
    const newVote = current.vote === vote ? null : vote;
    this.feedbacks[index] = { ...current, vote: newVote };
    this.submitFeedback(index);
  }

  private cdr = inject(ChangeDetectorRef);

  openCommentModal(index: number): void {
    this.modalMsgIndex = index;
    this.modalDraft = this.getFeedback(index).comment ?? '';
    this.showFeedbackModal = true;
    this.cdr.detectChanges(); // force Angular to pick up the change
  }

  closeCommentModal(): void {
    this.showFeedbackModal = false;
    this.modalMsgIndex = -1;
  }

  saveComment(): void {
    const index = this.modalMsgIndex;
    this.feedbacks[index] = { ...this.getFeedback(index), comment: this.modalDraft.trim() };
    this.submitFeedback(index);
    this.closeCommentModal();
  }

  private async submitFeedback(index: number): Promise<void> {
    const fb = this.getFeedback(index);
    const params = new URLSearchParams({ session_id: this.sessionId, message_index: String(index) });
    if (fb.vote) params.set('vote', fb.vote);
    if (fb.comment) params.set('comment', fb.comment);
    try {
      await fetch(`${this.API_URL}/feedback?${params.toString()}`, { method: 'GET', credentials: 'include' });
      this.saveConversation();
    } catch (err) {
      console.error('Failed to submit feedback', err);
    }
  }

  // ─── Save ──────────────────────────────────────────────────────────────────

  async saveConversation(): Promise<void> {
    try {
      const data = await fetch(`${this.API_URL}/save/${this.sessionId}`, {
        method: 'GET',
        credentials: 'include',
      }).then(res => res.json());
      console.log(data.message ?? 'Conversation saved!');
    } catch {
      console.error('Failed to save conversation.');
    }
  }
}
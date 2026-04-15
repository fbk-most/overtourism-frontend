// import { environment } from '../../../environments/environment';
import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { marked } from 'marked';

interface Message {
  sender: 'user' | 'bot';
  text: string;
  html?: string;
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

  // 🔹 Context injected by the page
  @Input() scenarioId1!: string;
  @Input() scenarioId2!: string;
  @Input() problemId!: string;

  // 🔹 UI state
  isOpen = false;
  isTyping = false;
  inputText = '';
  statusMessage = '';

  // 🔹 Chat state
  messages: Message[] = [];

  // 🔹 Session identifier
  sessionId!: string;

  // 🔹 Language selection
  language = 'Italian';

  private readonly API_URL = 'http://localhost:9000/agent';
  private eventSource: EventSource | null = null;

  // No external library needed
  private parseMarkdown(text: string): string {
    const result = marked.parse(text) as string;
    console.log('Parsed markdown:', result); // should show <strong>, <ul> etc.
    return result;
  }

  ngOnInit(): void {
    this.sessionId = this.generateSessionId();

    this.messages.push({
      sender: 'bot',
      text: 'Ciao! Come posso aiutarti?',
      html: 'Ciao! Come posso aiutarti?'
    });
  }

  ngOnDestroy(): void {
    this.closeEventSource();
  }

  private generateSessionId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private closeEventSource(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
  }

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

        if (data.session_id) {
          this.sessionId = data.session_id;
        }

        const responseText = data.response ?? 'No response received.';

        // parseMarkdown is called here when the bot response arrives
        this.messages.push({
          sender: 'bot',
          text: responseText,
          html: this.parseMarkdown(responseText)
        });

      } catch (err) {
        console.error('Error fetching result:', err);
        this.messages.push({
          sender: 'bot',
          text: 'Error fetching result.',
          html: 'Error fetching result.'
        });
      }

      this.isTyping = false;
      this.statusMessage = '';
    });

    this.eventSource.onerror = () => {
      this.closeEventSource();
      this.messages.push({
        sender: 'bot',
        text: 'Connection error. Please try again.',
        html: 'Connection error. Please try again.'
      });
      this.isTyping = false;
      this.statusMessage = '';
    };

    const formData = new FormData();
    formData.append('message', text);
    formData.append('session_id', this.sessionId);
    formData.append('user_lang', this.language);

    this.http.post(this.API_URL, formData).subscribe({
      error: (err) => {
        console.error('Chat API error:', err);
        this.closeEventSource();
        this.messages.push({
          sender: 'bot',
          text: 'Sorry, something went wrong.',
          html: 'Sorry, something went wrong.'
        });
        this.isTyping = false;
        this.statusMessage = '';
      }
    });
  }
}
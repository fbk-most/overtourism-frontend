import { environment } from '../../../environments/environment';
import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.scss']
})
export class ChatbotComponent implements OnInit {

  private http = inject(HttpClient);

  // 🔹 Context injected by the page
  @Input() scenarioId1!: string;
  @Input() scenarioId2!: string;
  @Input() problemId!: string;

  // 🔹 UI state
  isOpen = false;
  isTyping = false;
  inputText = '';

  // 🔹 Chat state
  messages: { sender: 'user' | 'bot'; text: string }[] = [];

  // 🔹 Session identifier (one per page load)
  sessionId!: string;

  ngOnInit(): void {
    this.sessionId = this.getSessionIdFromStorage();

    // Add initial bot message
    this.messages.push({
      sender: 'bot',
      text: 'Hi! How can I help you?'
    });
  }

  private getSessionIdFromStorage(): string {
    const stored = localStorage.getItem('session_info');
    if (!stored) return '';

    try {
      const { sessionId, timestamp } = JSON.parse(stored);
      const expired = Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000;
      if (!expired) return sessionId;
    } catch {}
    return '';
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
  }


  send(): void {
  const text = this.inputText.trim();
  if (!text) return;

  // User message
  this.messages.push({ sender: 'user', text });

  // Show typing indicator
  this.isTyping = true;

  const payload = {
    message: text,
    problem_id: this.problemId || null,
    scenario_ids: [this.scenarioId1, this.scenarioId2].filter(Boolean),
    session_id: this.sessionId || null
  };

  const url = `${environment.apiBaseUrl}/llm/chat`;

  this.http.post<{ reply: string }>(url, payload).subscribe({
    next: (res: { reply: string }) => {
      this.isTyping = false;
      this.messages.push({ sender: 'bot', text: res.reply });
    },
    error: (err: any) => {
      this.isTyping = false;
      console.error('Chat API error', err);
      this.messages.push({ sender: 'bot', text: 'Sorry, something went wrong.' });
    }
  });

  this.inputText = '';
}
}

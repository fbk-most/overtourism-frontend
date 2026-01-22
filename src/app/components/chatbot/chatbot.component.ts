import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
}

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

  // 🔹 Context injected by the page
  @Input() scenarioId!: string;
  @Input() problemId!: string;
  @Input() proposalId!: string;

  // 🔹 UI state
  isOpen = false;
  inputText = '';

  // 🔹 Chat state
  messages: ChatMessage[] = [];

  // 🔹 Session identifier (one per page load)
  sessionId!: string;

  ngOnInit(): void {
    this.sessionId = this.getSessionIdFromStorage();
  }

  private getSessionIdFromStorage(): string {
    const key = 'session_info';
    const stored = localStorage.getItem(key);
    const fallbackId = "";

    if (stored) {
      try {
        const { sessionId, timestamp } = JSON.parse(stored);
        const expired = Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000; // 7 days
        if (!expired) return sessionId;
      } catch {
        return fallbackId;
      }
    }

    return fallbackId;
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
  }

  send(): void {
    const text = this.inputText.trim();
    if (!text) {
      return;
    }

    // User message
    this.messages.push({
      sender: 'user',
      text
    });

    // Debug bot reply
    const botReply = [
      `scenarioId: ${this.scenarioId}`,
      `problemId: ${this.problemId}`,
      `proposalId: ${this.proposalId}`,
      `sessionId: ${this.sessionId}`
    ].join('\n');

    this.messages.push({
      sender: 'bot',
      text: botReply
    });

    this.inputText = '';
  }
}

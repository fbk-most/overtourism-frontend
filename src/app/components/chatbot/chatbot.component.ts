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
  @Input() scenarioId1!: string;
  @Input() scenarioId2!: string;
  @Input() problemId!: string;

  // 🔹 UI state
  isOpen = false;
  inputText = '';

  // 🔹 Chat state
  messages: ChatMessage[] = [];

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
      `problemId: ${this.problemId}`,
      `sessionId: ${this.sessionId}`,
      this.scenarioId1 ? `scenarioId1: ${this.scenarioId1}` : null,
      this.scenarioId2 ? `scenarioId2: ${this.scenarioId2}` : null
    ].filter(Boolean).join('\n');

    this.messages.push({
      sender: 'bot',
      text: botReply
    });

    this.inputText = '';
  }
}

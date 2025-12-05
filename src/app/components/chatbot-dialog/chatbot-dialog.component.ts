// chatbot-dialog.component.ts
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ChatbotService, ChatMessage } from '../../services/chatbot.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chatbot-dialog',
  templateUrl: './chatbot-dialog.component.html',
  styleUrls: ['./chatbot-dialog.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class ChatbotDialogComponent {

  userMessage = "";
  conversation: ChatMessage[] = [];

  constructor(
    private chatbotService: ChatbotService,
    private dialogRef: MatDialogRef<ChatbotDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit() {
    this.conversation = [];

    const scenario1 = JSON.stringify(this.data.scenario1, null, 2);
    const scenario2 = JSON.stringify(this.data.scenario2, null, 2);
    const differences = JSON.stringify(this.data.differences, null, 2);

    // Build the initial user request
    const initialUserMessage: ChatMessage = {
      role: 'user',
      content: `
      You are an expert in tourism management and sustainability, but your target audience may also include non-expert users, so start with simple and clear language and potentially increase the complexity of your responses based on the questions asked.
  I have two scenarios to compare.
  The difference between the two scenarios are these ${differences}
  Scenario 1 data:${scenario1}
  Scenario 2 data: ${scenario2}
  Please analyze both scenarios and provide me with a summary of a short text (3/4 short sentences) stating what are the difference between scenarios and how these impacted the results.
  In this whole conversation, round all numerical values to a maximum of two decimal places and never provide answers longer than a 2/3 sentences unless specifically asked.
      `.trim()
    };

    // Add message to conversation
    this.conversation.push(initialUserMessage);

    // Send to backend immediately
    this.chatbotService.sendConversation(this.conversation).subscribe({
      next: (res) => {
        // Push assistant's summary into chat
        this.conversation.push({
          role: 'assistant',
          content: res.reply + "\n\nCan I help you with something?"
        });
      },
      error: () => console.error("Errore nel contattare il backend")
    });
  }


  sendMessage() {
    if (!this.userMessage.trim()) return;

    // Add user message
    this.conversation.push({ role: 'user', content: this.userMessage });

    this.chatbotService.sendConversation(this.conversation).subscribe({
      next: (res) => {
        this.conversation.push({
          role: 'assistant',
          content: res.reply
        });
      },
      error: () => {
        console.error("Error contacting backend");
      }
    });

    this.userMessage = "";
  }

  close() {
    this.conversation = []; // clear memory
    this.dialogRef.close();
  }
}
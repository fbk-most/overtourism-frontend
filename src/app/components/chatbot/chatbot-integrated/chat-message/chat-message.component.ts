import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatChartPanelComponent } from '../chat-chart-panel/chat-chart-panel.component';
import { ChatSlidersPanelComponent } from '../chat-sliders-panel/chat-sliders-panel.component';
import { ChatFeedbackBarComponent } from '../chat-feedback-bar/chat-feedback-bar.component';
import { ChatFeedback } from '../../../../models/chat.model';
import { MarkdownPipe } from '../../../../pipes/markdown.pipe';
import { ChatMessage } from '../../../../services/chatbot.service';


@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [CommonModule, ChatChartPanelComponent, ChatSlidersPanelComponent, ChatFeedbackBarComponent, MarkdownPipe],
  templateUrl:'./chat-message.component.html'
})
export class ChatMessageComponent {
  @Input() msg!: ChatMessage;
  @Input() sessionId!: string;
  @Input() feedback: ChatFeedback = {};
  @Output() sliderSubmit = new EventEmitter<string>();
  @Output() voteChange = new EventEmitter<string | null>();
  @Output() commentChange = new EventEmitter<string>();
}
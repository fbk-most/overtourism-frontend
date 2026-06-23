import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatFeedback } from '../../../../models/chat.model';

@Component({
  selector: 'app-chat-feedback-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-feedback-bar.component.html',
  styleUrls: ['./chat-feedback-bar.component.scss']
})
export class ChatFeedbackBarComponent {
  @Input() feedback: ChatFeedback = {};
  @Output() voteChange = new EventEmitter<string | null>();
  @Output() commentChange = new EventEmitter<string>();

  showModal = false;
  draft = '';

  onVote(v: 'up' | 'down') {
    this.voteChange.emit(this.feedback.vote === v ? null : v);
  }

  openModal() {
    this.draft = this.feedback.comment || '';
    this.showModal = true;
  }

  saveComment() {
    this.commentChange.emit(this.draft.trim());
    this.showModal = false;
  }

  onOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) this.showModal = false;
  }
}
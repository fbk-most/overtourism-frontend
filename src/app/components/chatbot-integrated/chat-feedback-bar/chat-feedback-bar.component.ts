import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatFeedback } from '../../../models/chat.model';

@Component({
  selector: 'app-chat-feedback-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="feedback-bar">
      <button class="fb-btn" [class.fb-active-up]="feedback.vote === 'up'" title="Good response"
        (click)="onVote('up')">👍</button>
      <button class="fb-btn" [class.fb-active-down]="feedback.vote === 'down'" title="Bad response"
        (click)="onVote('down')">👎</button>
      <button class="fb-btn" [class.fb-has-comment]="feedback.comment" title="Add comment"
        (click)="openModal()">💬</button>
      <span *ngIf="feedback.comment" class="fb-comment-label">"{{ feedback.comment }}"</span>
    </div>

    <div class="fb-overlay" *ngIf="showModal" (click)="onOverlayClick($event)">
      <div class="fb-modal">
        <h3>Add feedback</h3>
        <textarea [(ngModel)]="draft" placeholder="What could be improved? (optional)" rows="4"></textarea>
        <div class="fb-modal-actions">
          <button class="fb-btn-cancel" (click)="showModal = false">Cancel</button>
          <button class="fb-btn-save" (click)="saveComment()">Save</button>
        </div>
      </div>
    </div>
  `
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
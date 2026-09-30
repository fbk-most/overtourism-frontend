import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatSlidersPanelComponent } from '../chat-sliders-panel/chat-sliders-panel.component';
import { ChatFeedbackBarComponent } from '../chat-feedback-bar/chat-feedback-bar.component';
import { AgentType, ChatFeedback, ChatMessage } from '../../../../models/chat.model';
import { MarkdownPipe } from '../../../../pipes/markdown.pipe';
import { SharedPlotComponent } from '../../../shared/shared-plot/shared-plot.component';
import { IconName, ItIconComponent } from 'design-angular-kit';

export interface AgentTypeMeta {
  label: string;
  icon: IconName;
  cssClass: string;
}

const AGENT_TYPE_MAP: Record<AgentType, AgentTypeMeta> = {
  executor: {
    label: 'Executor',
    icon: 'settings',
    cssClass: 'agent-executor'
  },
  operative: {
    label: 'Operativo',
    icon: 'user',
    cssClass: 'agent-operative'
  },
  methodological: {
    label: 'Metodologico',
    icon: 'file',
    cssClass: 'agent-methodological'
  },
  exploitative: {
    label: 'Esplorativo',
    icon: 'search',
    cssClass: 'agent-exploitative'
  }
};

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [CommonModule, ChatSlidersPanelComponent, ChatFeedbackBarComponent, SharedPlotComponent, MarkdownPipe, ItIconComponent],
  templateUrl:'./chat-message.component.html',
  styleUrls: ['./chat-message.component.scss']

})
export class ChatMessageComponent {
  @Input() msg!: ChatMessage;
  @Input() sessionId!: string;
  @Input() feedback: ChatFeedback = {};
  @Output() sliderSubmit = new EventEmitter<string>();
  @Output() voteChange = new EventEmitter<string | null>();
  @Output() commentChange = new EventEmitter<string>();
  get agentMeta(): AgentTypeMeta | null {
    if (this.msg.role !== 'assistant' || !this.msg.agentType) return null;
    return AGENT_TYPE_MAP[this.msg.agentType] || null;
  }
}


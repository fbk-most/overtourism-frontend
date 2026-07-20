import { Component, Input, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { marked } from 'marked';
import { ChatbotAction, ChatbotActionService } from '../../../services/chatbot/chatbotAction.service';
import { ChatbotContextService } from '../../../services/chatbot/chatbotContext.service';
import { SharedHistogramComponent } from '../../shared/shared-histogram/shared-histogram.component';
import { SharedKpisComponent } from '../../shared/shared-kpis/shared-kpis.component';

interface Feedback {
  vote?: 'up' | 'down' | null;
  comment?: string;
}

interface Message {
  sender: 'user' | 'bot';
  text: string;
  html?: string;
  index?: number; // assigned when pushed, for feedback keying
  inlineActions?: ChatbotAction[]; 
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.scss']
})
export class ChatbotComponent implements OnInit, OnDestroy {

  readonly widgetRegistry: Record<string, any> = {
    'histogramComparison': SharedHistogramComponent,
    'kpiList': SharedKpisComponent,
    //altri widget slider con widget
  };
  private http = inject(HttpClient);
  private contextService = inject(ChatbotContextService);
  private actionService = inject(ChatbotActionService);


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
    if (this.checkSimulatedFlows(text)) {
      this.isTyping = false;
      return;
    }
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

    // const validScenarioIds = [this.scenarioId1, this.scenarioId2].filter(
    //   id => typeof id === 'string' && id.trim().length > 0
    // );
    // if (validScenarioIds.length > 0) {
    //   formData.append('integrated_mode', 'true');
    //   validScenarioIds.forEach(id => formData.append('context', id));
    // }
    const problemId = this.contextService.problemId$.getValue();
    const scenarios = this.contextService.scenarioIds$.getValue();

    if (problemId) formData.append('problem_id', problemId);
    if (scenarios.length) {
      formData.append('integrated_mode', 'true');
      scenarios.forEach(id => formData.append('context', id));
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
    } catch (err) {
      console.error('Failed to submit feedback', err);
    }
  }
    /** Parsing della risposta strutturata dal backend (o dalla simulazione) */
    private handleBotResponse(data: { response: string, actions?: ChatbotAction[] }): void {
      const inlineActions: ChatbotAction[] = [];
  
      if (data.actions && Array.isArray(data.actions)) {
        data.actions.forEach(action => {
          if (action.type === 'SHOW_WIDGET') {
            inlineActions.push(action);
          } else {
            this.actionService.dispatch(action);
          }
        });
      }
  
      // Aggiunge il messaggio in chat con le eventuali azioni visuali
      const index = this.messages.length;
      this.messages.push({
        sender: 'bot',
        text: data.response,
        html: this.parseMarkdown(data.response),
        index,
        inlineActions: inlineActions.length > 0 ? inlineActions : undefined
      });
    }
     // --- MOTORE DI SIMULAZIONE (MOCK BACKEND) ---
  private checkSimulatedFlows(text: string): boolean {
    const input = text.trim().toLowerCase();

    // Dizionario dei Payload JSON che il vero backend potrebbe inviare
    const MOCK_RESPONSES: Record<string, { response: string, actions?: ChatbotAction[] }> = {
      
      // 1. NAVIGAZIONE SEMPLICE
      'mostrami i problemi': {
        response: 'Certamente, ti riporto alla lista dei problemi per selezionarne un altro.',
        actions: [
          { type: 'NAVIGATE', payload: { path: '/problems' } }
        ]
      },

      // 2. AZIONE GLOBALE (Creazione backend + Navigazione)
      'crea scenario ecologico': {
        response: 'Ho creato il nuovo scenario "Ecologico" impostando i posteggi al 20%. Ti ci porto subito.',
        actions: [
          { 
            type: 'CREATE_SCENARIO', 
            payload: { 
              name: 'Scenario Ecologico Automatico', 
              params: { tourists_parking_percentage: 20 } 
            } 
          },
          { type: 'NAVIGATE', payload: { path: '/problems' } 
          }
        ]
      },

      // 3. WIDGET INLINE: ISTOGRAMMA
      'confronta gli indici': {
        response: 'Ecco il grafico con la comparazione tra lo Scenario Attuale e la mia Proposta:',
        actions: [
          { 
            type: 'SHOW_WIDGET', 
            payload: { 
              widgetName: 'histogramComparison', 
              data: { 
                payload: { 
                  labelLeft: 'Attuale', 
                  labelRight: 'Proposta', 
                  dataLeft: { "Soddisfazione": { level: 60, confidence: 2 }, "Traffico": { level: 80, confidence: 5 } }, 
                  dataRight: { "Soddisfazione": { level: 85, confidence: 3 }, "Traffico": { level: 40, confidence: 4 } } 
                }, 
                loading: false 
              }
            } 
          }
        ]
      },

      // 4. WIDGET INLINE: KPI LIST (Usando SharedKpisComponent)
      'dimmi i kpi base': {
        response: 'Questi sono gli indici di criticità calcolati per la situazione di default:',
        actions: [
          {
            type: 'SHOW_WIDGET',
            payload: {
              widgetName: 'kpiList',
              data: {
                kpisMain: {
                  'overtourism_level': { level: 88, confidence: 2 },
                  'Giorni di blocco': { level: 12, confidence: 0 }
                }
              }
            }
          }
        ]
      }
    };

    // Se l'utente digita una delle chiavi magiche, eseguiamo la simulazione
    if (MOCK_RESPONSES[input]) {
      setTimeout(() => {
        this.handleBotResponse(MOCK_RESPONSES[input]);
        this.isTyping = false;
      }, 1000); // Finge 1 secondo di caricamento rete
      return true;
    }

    return false;
  }
}
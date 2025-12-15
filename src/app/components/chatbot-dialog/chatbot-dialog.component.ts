import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ChatbotService, ChatMessage } from '../../services/chatbot.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ChartSummary, ChartSeriesSummary } from '../../models/chart-summary.model';

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

  private formatChartSummaries(charts: ChartSummary[] = []): string {
    if (!charts || charts.length === 0) return "No chart data available.";

    return charts
      .map(chart => {
        const seriesSummaries = (chart.series || [])
          .map((s: ChartSeriesSummary) => 
            `${s.name} (Scenario: ${s.scenario}) → min: ${s.min}, max: ${s.max}, avg: ${s.avg}, trend: ${s.trend}`
          )
          .join("; ");

        return `Chart: ${chart.title} [${chart.subsystem}, ${chart.dimension}] → ${seriesSummaries}`;
      })
      .join("\n");
  }

ngOnInit() {
  this.conversation = [];

  const scenarioLeft = this.data.scenarios?.left || {};
  const scenarioRight = this.data.scenarios?.right || {};
  const differences = JSON.stringify(this.data.comparisons?.widgetDiffs || [], null, 2);

  const chartsArray: ChartSummary[] = [
    ...(scenarioLeft.charts || []),
    ...(scenarioRight.charts || [])
  ];

  const charts = this.formatChartSummaries(chartsArray);

  const initialUserMessage: ChatMessage = {
    role: 'user',
    content: `
You are an expert in tourism management and sustainability.
Use clear and simple language by default so that non-experts can understand you, and increase technical depth only when the user's question requires it.
Answer as concisely as possible, ideally in one sentence unless explicitly asked for a longer explanation.
Round all numerical values to a maximum of two decimal places.

You have access to scenario data and chart summaries.

Initial conditions differences: ${differences}

Scenario1 KPIs: ${JSON.stringify(scenarioLeft.kpis || {}, null, 2)}

Scenario2 KPIs: ${JSON.stringify(scenarioRight.kpis || {}, null, 2)}

Chart summaries:
${charts}

Please provide a concise summary of the key differences between the two scenarios based on the provided data.
    `.trim()
  };

  console.log("Initial chatbot message:", initialUserMessage);

  this.conversation.push(initialUserMessage);

  this.chatbotService.sendConversation(this.conversation).subscribe({
    next: (res) => {
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

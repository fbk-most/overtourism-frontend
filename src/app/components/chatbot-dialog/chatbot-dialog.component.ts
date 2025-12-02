import { Component } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-chatbot-dialog',
  templateUrl: './chatbot-dialog.component.html',
  standalone: true,
  imports: [MatDialogModule]
})
export class ChatbotDialogComponent {}
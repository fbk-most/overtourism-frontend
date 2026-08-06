import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { UIAction } from '../../models/chat.model';

@Injectable({ providedIn: 'root' })
export class ChatbotActionService {
  private router = inject(Router);

  execute(action: UIAction): void {
    switch (action.type) {
      case 'NAVIGATE':
        const navPayload = action.payload;
        if (navPayload['queryParams']) {
          this.router.navigate(navPayload['path'], { queryParams: navPayload['queryParams'] });
        } else {
          this.router.navigate(navPayload['path']);
        }
        break;
      case 'SHOW_TOAST':
        // TODO Collega al tuo ToastService esistente 
        console.info('[Toast]', action.payload['message']);
        break;
      case 'SHOW_WIDGET':
        // Gestito inline dal componente standalone 
        break;
      default:
        console.warn('[ChatbotActionService] Azione UI non riconosciuta:', action);
    }
  }
}
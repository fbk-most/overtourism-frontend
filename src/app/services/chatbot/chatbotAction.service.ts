import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
// Importa i tuoi servizi come ScenarioService, ProblemService...

export type ActionType = 'NAVIGATE' | 'CREATE_SCENARIO' | 'SHOW_WIDGET' | 'UPDATE_FILTERS';

export interface ChatbotAction {
    type: ActionType;
    // Payload generico!
    payload: {
      widgetName?: string; // Nome logico del component da mappare
      data?: any;          // Dati da passargli in @Input()
      [key: string]: any;  
    };
  }

@Injectable({ providedIn: 'root' })
export class ChatbotActionService {
  private router = inject(Router);

  dispatch(action: ChatbotAction) {
    switch (action.type) {
      case 'NAVIGATE':
        this.router.navigate([action.payload['path']]);
        break;
      case 'CREATE_SCENARIO':
        // 1. Esegui la POST via service
        // 2. Naviga alla pagina di dettaglio
        console.log('Creazione scenario...', action.payload);
        // this.scenarioService.createScenario(...).subscribe(id => this.router.navigate([...]));
        break;
      case 'UPDATE_FILTERS':
        // Invia evento su un Subject a cui il plot component è iscritto
        break;
      default:
        console.warn('Azione non riconosciuta', action);
    }
  }
}
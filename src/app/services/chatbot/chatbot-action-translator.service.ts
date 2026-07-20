import { Injectable } from '@angular/core';
import { DomainEvent, UIAction } from '../../models/chat.model';

@Injectable({ providedIn: 'root' })
export class ChatbotActionTranslatorService {

  /**
   * Traduce un DomainEvent in UIActions per il chatbot INTEGRATO.
   * L'integrato naviga nell'app, mostra toast, aggiorna il contesto.
   */
  translateForIntegrated(event: DomainEvent): UIAction[] {
    switch (event.type) {

      case 'SCENARIO_CREATED':
        return [
          { 
            type: 'NAVIGATE', 
            payload: { 
              path: `/problems/${event.payload['problem_id']}/proposals/${event.payload['proposal_id']}/scenari/${event.payload['scenario_id']}` 
            } 
          },
          { type: 'SHOW_TOAST', payload: { message: `Scenario "${event.payload['name']}" creato con successo!`, level: 'success' } }
        ];

      case 'SCENARIO_UPDATED':
        return [
          { type: 'SHOW_TOAST', payload: { message: 'Scenario aggiornato.', level: 'info' } }
        ];

      case 'COMPARISON_READY':
        return [
          {
            type: 'NAVIGATE',
            payload: {
              path: `/problems/${event.payload['problem_id']}/proposals/${event.payload['proposal_id']}/scenari/confronta/${event.payload['scenario_id_1']}/${event.payload['scenario_id_2']}`
            }
          }
        ];

      case 'NAVIGATION_REQUESTED':
        return [
          { type: 'NAVIGATE', payload: { path: event.payload['path'] } }
        ];

      default:
        return [];
    }
  }

  /**
   * Traduce un DomainEvent in UIActions per il chatbot STANDALONE.
   * Lo standalone mostra widget inline nel flusso della chat.
   */
  translateForStandalone(event: DomainEvent): UIAction[] {
    switch (event.type) {

      case 'COMPARISON_READY':
        const actions: UIAction[] = [];

        // Se c'è histogram_data → mostra istogramma
        if (event.payload['histogram_data']) {
          actions.push({
            type: 'SHOW_WIDGET',
            payload: {
              widgetName: 'histogramComparison',
              data: {
                payload: event.payload['histogram_data'],
                loading: false
              }
            }
          });
        }

        // Se ci sono kpis_left + kpis_right → mostra KPI comparazione
        if (event.payload['kpis_left'] && event.payload['kpis_right']) {
          actions.push({
            type: 'SHOW_WIDGET',
            payload: {
              widgetName: 'kpiList',
              data: {
                kpisMain: event.payload['kpis_left'],
                kpisCompare: event.payload['kpis_right']
              }
            }
          });
        }
        return actions;

      case 'EVALUATION_READY':
        const evalActions: UIAction[] = [];

        // Se ci sono kpis → mostra KPI singolo
        if (event.payload['kpis']) {
          evalActions.push({
            type: 'SHOW_WIDGET',
            payload: {
              widgetName: 'kpiList',
              data: { kpisMain: event.payload['kpis'] }
            }
          });
        }

        // Se c'è plot → mostra grafico
        if (event.payload['plot']) {
          evalActions.push({
            type: 'SHOW_WIDGET',
            payload: {
              widgetName: 'plot',
              data: {
                payload: event.payload['plot'],
                loading: false
              }
            }
          });
        }
        return evalActions;

      case 'SCENARIO_CREATED':
        return []; // Standalone non naviga, mostra solo il messaggio testuale

      default:
        return [];
    }
  }
}
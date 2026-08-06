import { Injectable } from '@angular/core';
import { DomainEvent, UIAction } from '../../models/chat.model';

@Injectable({ providedIn: 'root' })
export class ChatbotActionTranslatorService {

  /**
   * Traduce un DomainEvent in UIActions per il chatbot INTEGRATO.
   */
  translateForIntegrated(event: DomainEvent): UIAction[] {
    const payload = event.payload || {};

    switch (event.type) {
      case 'NAVIGATE': {
        const target = payload['target']; // es. "PROBLEMS", "PROPOSALS", "Index"
        
        if (target === 'PROBLEMS') {
          return [{ type: 'NAVIGATE', payload: { path: ['/problems'] } }];
        }
        if (target === 'PROPOSALS') {
          return [{ type: 'NAVIGATE', payload: { path: ['/problems', payload['idProblem'], 'proposals'] } }];
        }
        if (target === 'SCENARIOS') {
          return [{ type: 'NAVIGATE', payload: { path: ['/problems', payload['idProblem'], 'proposals', payload['idProposal'], 'scenari'] } }];
        }
        if (target === 'SCENARIO') {
          return [{ type: 'NAVIGATE', payload: { path: ['/problems', payload['idProblem'], 'proposals', payload['idProposal'], 'scenari', payload['idScenario']] } }];
        }
        if (target === 'Index') {
          // Naviga agli indici passando i filtri come query parameters
          return [{ type: 'NAVIGATE', payload: { path: ['/indici'], queryParams: payload['param'] } }];
        }
        break;
      }

      case 'COMPARE_SCENARIO':
        return [{ type: 'NAVIGATE', payload: { 
          path: ['/problems', payload['idProblem'], 'proposals', payload['idProposal'], 'scenari', 'confronta', payload['idScenario1'], payload['idScenario2']] 
        } }];

      case 'DELETED': {
        // Se elimini, torni alla lista padre
        const target = payload['target'];
        if (target === 'SCENARIO') {
          return [{ type: 'NAVIGATE', payload: { path: ['/problems', payload['idProblem'], 'proposals', payload['idProposal'], 'scenari'] } }];
        }
        if (target === 'PROPOSTA') {
          return [{ type: 'NAVIGATE', payload: { path: ['/problems', payload['idProblem'], 'proposals'] } }];
        }
        if (target === 'PROBLEMA') {
          return [{ type: 'NAVIGATE', payload: { path: ['/problems'] } }];
        }
        break;
      }
    }

    return [];
  }

  /**
   * Traduce un DomainEvent in UIActions per il chatbot STANDALONE.
   * Lo standalone mostra widget inline nel flusso della chat.
   */
  translateForStandalone(event: DomainEvent): UIAction[] {
    switch (event.type) {

      // case 'SHOW_WIDGET': {
      //   const { widget, ...componentInputs } = event.payload;
      //   let mappedInputs: Record<string, any> = { ...componentInputs };

      //   // ── MAPPIAMO I DATI ──
        
      //   if (widget === 'indexComparison') {
      //     // SharedKpisComponent si aspetta kpisMain e kpisCompare
      //     mappedInputs = { 
      //       kpisMain: componentInputs['payload1'], 
      //       kpisCompare: componentInputs['payload2'] 
      //     };
      //   } 
      //   else if (widget === 'histogramComparison') {
      //     // SharedHistogramComponent si aspetta un oggetto `payload` unico
      //     mappedInputs = { 
      //       payload: {
      //         labelLeft: 'Scenario Attuale',
      //         labelRight: 'Scenario Proposto',
      //         dataLeft: componentInputs['payload1'],
      //         dataRight: componentInputs['payload2']
      //       }
      //     };
      //   } 
      //   else if (widget === 'plot') {
      //     mappedInputs = { 
      //       payload: componentInputs['payload1'] 
      //     };
      //   } 
      //   else if (widget === 'map' || widget === 'variationMap') {
      //     // Placeholder per IndiciMapComponent o OvertourismMapComponent
      //     // Puoi mappare qui gli @Input se la mappa è pronta
      //     mappedInputs = { geojsonStr: JSON.stringify(componentInputs['geodata']) };
      //   }

      //   return [{
      //     type: 'SHOW_WIDGET',
      //     payload: {
      //       widgetName: widget,
      //       data: mappedInputs
      //     }
      //   }];
      // }
      case 'SHOW_WIDGET': 
        // Il backend manda già format { widgetName: '...', data: { ... } }
        // Passiamo direttamente il payload!
        return [{
          type: 'SHOW_WIDGET',
          payload: event.payload
        }];
      // case 'COMPARISON_READY':
      //   const actions: UIAction[] = [];

      //   // Se c'è histogram_data → mostra istogramma
      //   if (event.payload['histogram_data']) {
      //     actions.push({
      //       type: 'SHOW_WIDGET',
      //       payload: {
      //         widgetName: 'histogramComparison',
      //         data: {
      //           payload: event.payload['histogram_data'],
      //           loading: false
      //         }
      //       }
      //     });
      //   }

      //   // Se ci sono kpis_left + kpis_right → mostra KPI comparazione
      //   if (event.payload['kpis_left'] && event.payload['kpis_right']) {
      //     actions.push({
      //       type: 'SHOW_WIDGET',
      //       payload: {
      //         widgetName: 'kpiList',
      //         data: {
      //           kpisMain: event.payload['kpis_left'],
      //           kpisCompare: event.payload['kpis_right']
      //         }
      //       }
      //     });
      //   }
      //   return actions;

      // case 'EVALUATION_READY':
      //   const evalActions: UIAction[] = [];

      //   // Se ci sono kpis → mostra KPI singolo
      //   if (event.payload['kpis']) {
      //     evalActions.push({
      //       type: 'SHOW_WIDGET',
      //       payload: {
      //         widgetName: 'kpiList',
      //         data: { kpisMain: event.payload['kpis'] }
      //       }
      //     });
      //   }

      //   // Se c'è plot → mostra grafico
      //   if (event.payload['plot']) {
      //     evalActions.push({
      //       type: 'SHOW_WIDGET',
      //       payload: {
      //         widgetName: 'plot',
      //         data: {
      //           payload: event.payload['plot'],
      //           loading: false
      //         }
      //       }
      //     });
      //   }
      //   return evalActions;

      // case 'SCENARIO_CREATED':
      //   return []; // Standalone non naviga, mostra solo il messaggio testuale

      default:
        return [];
    }
  }
}
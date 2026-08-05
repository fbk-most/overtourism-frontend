import { Injectable } from '@angular/core';
import { AgentResponse } from '../../models/chat.model';

@Injectable({ providedIn: 'root' })
export class ChatMockService {

  private MOCKS: Record<string, AgentResponse> = {
   // ── Istogramma comparazione (Input attesi: payload)
   'confronta gli indici': {
    response: 'Ecco il confronto tra gli scenari:',
    assistant_action_data: [{
      type: 'SHOW_WIDGET',
      payload: {
        widgetName: 'histogramComparison',  
        data: {
          payload: {
            labelLeft: "Scenario Attuale",
            labelRight: "Scenario Prossimo",
            dataLeft: {
              "Overtourism": { "level": 0.70, "confidence": 0 },
              "Soddisfazione": { "level": 0.94, "confidence": 0 }
            },
            dataRight: {
              "Overtourism": { "level": 0.86, "confidence": 0 },
              "Soddisfazione": { "level": 0.96, "confidence": 0 }
            }
          },
          loading: false
        }
      }
    }]
  },

  // ── KPI comparazione (Input attesi: kpisMain, kpisCompare)
  'confronta i kpi': {
    response: 'Ecco i KPI comparati tra i due scenari:',
    assistant_action_data: [{
      type: 'SHOW_WIDGET',
      payload: {
        widgetName: 'indexComparison',  
        data: {
          kpisMain: {
            'overtourism_level': { level: 88, confidence: 2 },
            'constraint_level_beach': { level: 95, confidence: 1 },
            'Soddisfazione': { level: 65, confidence: 3 }
          },
          kpisCompare: {
            'overtourism_level': { level: 65, confidence: 3 },
            'constraint_level_beach': { level: 70, confidence: 2 },
            'Soddisfazione': { level: 88, confidence: 3 }
          }
        }
      }
    }]
  },

  'mostrami il grafico mono': {
    response: 'Ecco il grafico monodimensionale:',
    assistant_action_data: [{
      type: 'SHOW_WIDGET',
      payload: {
        widgetName: 'plot',  
        data: {
          payload: {
            type: 'mono',
            subsystem: 'default',
            data: {
              curves: [], // Mono dimensionale non usa le curve, ma disegna capacityMean
              points: [
                {
                  name: "Presenze",
                  x: [0, 1, 2, 3], 
                  y: [100, 200, 400, 800], 
                  customdata: [10, 20, 50, 95], // risk level %
                  marker: {
                    color: [0.1, 0.2, 0.5, 0.95],
                    size: 8
                  },
                  mode: "markers",
                  type: "scatter"
                }
              ],
              kpis: {
                uncertainty: [
                  { usage: 100, usage_uncertainty: 0.1, tourists: 100, excursionists: 50, index: 0.1 },
                  { usage: 200, usage_uncertainty: 0.2, tourists: 150, excursionists: 80, index: 0.2 },
                  { usage: 400, usage_uncertainty: 0.5, tourists: 200, excursionists: 150, index: 0.5 },
                  { usage: 800, usage_uncertainty: 0.95, tourists: 400, excursionists: 300, index: 0.95 }
                ]
              },
              capacity_mean: 500, // per la riga tratteggiata
              xMax: 4,
              yMax: 1000
            }
          },
          loading: false
        }
      }
    }]
  },

  // ── Plot bidimensionale (curva limite col punto rosso)
  'mostrami il grafico bi': {
    response: 'Ecco il grafico di sostenibilità:',
    assistant_action_data: [{
      type: 'SHOW_WIDGET',
      payload: {
        widgetName: 'plot',  
        data: {
          payload: {
            type: 'bi',
            subsystem: 'default',
            data: {
              curves: [
                { 
                  name: 'Capacità spiagge', 
                  x: [0, 500, 1000, 1500], 
                  y: [2000, 1500, 500, 0], 
                  color: 'rgb(180,4,38)',
                  dash: 'dash' 
                }
              ],
              points: [
                {
                  name: 'Attuale',
                  x: [400], 
                  y: [800], 
                  color: 'red',
                  marker: { size: 10, color: 'blue' }
                }
              ],
              xMax: 2000, 
              yMax: 2500
            }
          },
          loading: false
        }
      }
    }]
  },

  // ── Mappa indicatore (Input attesi: geojsonStr, minValue, maxValue)
  'mostrami la mappa': {
    response: 'Ecco la mappa tematica del territorio:',
    assistant_action_data: [{
      type: 'SHOW_WIDGET',
      payload: {
        widgetName: 'map', // Corretto
        data: {
          // IndiciMapComponent si aspetta una stringa per geojsonStr!
          geojsonStr: JSON.stringify({
            "type": "FeatureCollection",
            "features": [
              {
                "type": "Feature",
                "properties": { "AREA_NAME": "Riva del Garda", "INDICE": 85 },
                "geometry": {
                  "type": "Polygon",
                  "coordinates": [[[10.84, 45.88], [10.84, 45.90], [10.86, 45.90], [10.86, 45.88], [10.84, 45.88]]]
                }
              }
            ]
          }),
          minValue: 0,
          maxValue: 100
        }
      }
    }]
  }


    // // ── Variazione mappa (widget: variationMap, params: geodata)
    // 'mostrami map variazione': {
    //   response: 'Mappa di variazione generata.',
    //   events: [{
    //     type: 'SHOW_WIDGET',
    //     payload: {
    //       widget: 'variationMap',
    //       geodata: { delta: '+20%', zones: ['Zona A'] }
    //     }
    //   }]
    // }


    // // ── Navigazione ──────────────────────────────────────────────────────────
    // 'mostrami i problemi': {
    //   response: 'Ti riporto alla lista dei problemi.',
    //   events: [{ type: 'NAVIGATION_REQUESTED', payload: { path: '/problems' } }]
    // },

    // // ── Creazione scenario ───────────────────────────────────────────────────
    // 'crea scenario ecologico': {
    //   response: 'Ho creato lo scenario "Ecologico" con parcheggi al 20%.',
    //   events: [{
    //     type: 'SCENARIO_CREATED',
    //     payload: {
    //       scenario_id: 'mock-scenario-001',
    //       name: 'Scenario Ecologico',
    //       problem_id: 'mock-problem-001',
    //       proposal_id: 'mock-proposal-001'
    //     }
    //   }]
    // },

    // // ── Istogramma comparazione ──────────────────────────────────────────────
    // // Standalone → mostra SharedHistogramComponent inline
    // // Integrated → naviga alla pagina confronto
    // 'confronta gli indici': {
    //   response: 'Ecco il confronto tra gli scenari:',
    //   events: [{
    //     type: 'COMPARISON_READY',
    //     payload: {
    //       scenario_id_1: 'mock-s1',
    //       scenario_id_2: 'mock-s2',
    //       problem_id: 'mock-problem-001',
    //       proposal_id: 'mock-proposal-001',
    //       histogram_data: {
    //         labelLeft: 'Scenario Attuale',
    //         labelRight: 'Scenario Proposto',
    //         dataLeft: {
    //           'Overtourism': { level: 88, confidence: 3 },
    //           'Soddisfazione': { level: 60, confidence: 2 },
    //           'Traffico': { level: 80, confidence: 5 }
    //         },
    //         dataRight: {
    //           'Overtourism': { level: 65, confidence: 4 },
    //           'Soddisfazione': { level: 85, confidence: 3 },
    //           'Traffico': { level: 40, confidence: 4 }
    //         }
    //       }
    //     }
    //   }]
    // },

    // // ── KPI list ─────────────────────────────────────────────────────────────
    // // Standalone → mostra SharedKpisComponent inline
    // 'dimmi i kpi base': {
    //   response: 'Questi sono gli indici calcolati per la situazione attuale:',
    //   events: [{
    //     type: 'EVALUATION_READY',
    //     payload: {
    //       kpis: {
    //         'overtourism_level': { level: 88, confidence: 2 },
    //         'constraint_level_beach': { level: 95, confidence: 1 },
    //         'constraint_level_parking': { level: 72, confidence: 3 }
    //       }
    //     }
    //   }]
    // },

    // // ── Plot monodimensionale ────────────────────────────────────────────────
    // // Standalone → mostra SharedPlotComponent inline
    // 'mostrami il grafico mono': {
    //   response: 'Ecco il grafico monodimensionale per lo scenario attuale:',
    //   events: [{
    //     type: 'EVALUATION_READY',
    //     payload: {
    //       plot: {
    //         type: 'mono',       // 'mono' | 'bi'
    //         subsystem: 'default',
    //         data: {
    //           curves: [
    //             {
    //               name: 'default',
    //               x: [0, 500, 1000, 1500, 2000, 2500, 3000],
    //               y: [0, 0.1, 0.3, 0.5, 0.75, 0.9, 1.0],
    //               color: '#0066CC'
    //             }
    //           ],
    //           points: [
    //             { x: [1800], y: [0.65], name: 'Situazione attuale', color: 'red' }
    //           ],
    //           xMax: 3000,
    //           yMax: 1.0
    //         }
    //       }
    //     }
    //   }]
    // },

    // // ── KPI comparazione (due scenari) ───────────────────────────────────────
    // 'confronta i kpi': {
    //   response: 'Ecco i KPI comparati tra i due scenari:',
    //   events: [{
    //     type: 'COMPARISON_READY',
    //     payload: {
    //       kpis_left: {
    //         'overtourism_level': { level: 88, confidence: 2 },
    //         'constraint_level_beach': { level: 95, confidence: 1 }
    //       },
    //       kpis_right: {
    //         'overtourism_level': { level: 65, confidence: 3 },
    //         'constraint_level_beach': { level: 70, confidence: 2 }
    //       }
    //     }
    //   }]
    // }
  };

  find(input: string): AgentResponse | null {
    return this.MOCKS[input.trim().toLowerCase()] ?? null;
  }
}
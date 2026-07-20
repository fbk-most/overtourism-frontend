import { Injectable } from '@angular/core';
import { AgentResponse } from '../../models/chat.model';

@Injectable({ providedIn: 'root' })
export class ChatMockService {

  private MOCKS: Record<string, AgentResponse> = {

    // ── Navigazione ──────────────────────────────────────────────────────────
    'mostrami i problemi': {
      response: 'Ti riporto alla lista dei problemi.',
      events: [{ type: 'NAVIGATION_REQUESTED', payload: { path: '/problems' } }]
    },

    // ── Creazione scenario ───────────────────────────────────────────────────
    'crea scenario ecologico': {
      response: 'Ho creato lo scenario "Ecologico" con parcheggi al 20%.',
      events: [{
        type: 'SCENARIO_CREATED',
        payload: {
          scenario_id: 'mock-scenario-001',
          name: 'Scenario Ecologico',
          problem_id: 'mock-problem-001',
          proposal_id: 'mock-proposal-001'
        }
      }]
    },

    // ── Istogramma comparazione ──────────────────────────────────────────────
    // Standalone → mostra SharedHistogramComponent inline
    // Integrated → naviga alla pagina confronto
    'confronta gli indici': {
      response: 'Ecco il confronto tra gli scenari:',
      events: [{
        type: 'COMPARISON_READY',
        payload: {
          scenario_id_1: 'mock-s1',
          scenario_id_2: 'mock-s2',
          problem_id: 'mock-problem-001',
          proposal_id: 'mock-proposal-001',
          histogram_data: {
            labelLeft: 'Scenario Attuale',
            labelRight: 'Scenario Proposto',
            dataLeft: {
              'Overtourism': { level: 88, confidence: 3 },
              'Soddisfazione': { level: 60, confidence: 2 },
              'Traffico': { level: 80, confidence: 5 }
            },
            dataRight: {
              'Overtourism': { level: 65, confidence: 4 },
              'Soddisfazione': { level: 85, confidence: 3 },
              'Traffico': { level: 40, confidence: 4 }
            }
          }
        }
      }]
    },

    // ── KPI list ─────────────────────────────────────────────────────────────
    // Standalone → mostra SharedKpisComponent inline
    'dimmi i kpi base': {
      response: 'Questi sono gli indici calcolati per la situazione attuale:',
      events: [{
        type: 'EVALUATION_READY',
        payload: {
          kpis: {
            'overtourism_level': { level: 88, confidence: 2 },
            'constraint_level_beach': { level: 95, confidence: 1 },
            'constraint_level_parking': { level: 72, confidence: 3 }
          }
        }
      }]
    },

    // ── Plot monodimensionale ────────────────────────────────────────────────
    // Standalone → mostra SharedPlotComponent inline
    'mostrami il grafico mono': {
      response: 'Ecco il grafico monodimensionale per lo scenario attuale:',
      events: [{
        type: 'EVALUATION_READY',
        payload: {
          plot: {
            type: 'mono',       // 'mono' | 'bi'
            subsystem: 'default',
            data: {
              curves: [
                {
                  name: 'default',
                  x: [0, 500, 1000, 1500, 2000, 2500, 3000],
                  y: [0, 0.1, 0.3, 0.5, 0.75, 0.9, 1.0],
                  color: '#0066CC'
                }
              ],
              points: [
                { x: [1800], y: [0.65], name: 'Situazione attuale', color: 'red' }
              ],
              xMax: 3000,
              yMax: 1.0
            }
          }
        }
      }]
    },

    // ── KPI comparazione (due scenari) ───────────────────────────────────────
    'confronta i kpi': {
      response: 'Ecco i KPI comparati tra i due scenari:',
      events: [{
        type: 'COMPARISON_READY',
        payload: {
          kpis_left: {
            'overtourism_level': { level: 88, confidence: 2 },
            'constraint_level_beach': { level: 95, confidence: 1 }
          },
          kpis_right: {
            'overtourism_level': { level: 65, confidence: 3 },
            'constraint_level_beach': { level: 70, confidence: 2 }
          }
        }
      }]
    }
  };

  find(input: string): AgentResponse | null {
    return this.MOCKS[input.trim().toLowerCase()] ?? null;
  }
}
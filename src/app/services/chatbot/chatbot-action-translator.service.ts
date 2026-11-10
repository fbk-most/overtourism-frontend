import { Injectable } from '@angular/core';
import { DomainEvent, UIAction } from '../../models/chat.model';
import { PlotService } from '../plot.service';
import { firstValueFrom } from 'rxjs';
import { ScenarioService } from '../scenario.service';
import { getComparisonChartKpis } from '../../utils/kpi.utils';

@Injectable({ providedIn: 'root' })
export class ChatbotActionTranslatorService {
  constructor(private plotService: PlotService,
    private scenarioService: ScenarioService
  ) { }

  /**
   * Traduce un DomainEvent in UIActions per il chatbot INTEGRATO.
   */
  translateForIntegrated(event: DomainEvent): UIAction[] {
    const payload = event.payload || {};
    const rawTerritory =
      payload['territory'] ??
      payload['territorio'] ??
      payload['activeTerritory'] ??
      payload['targetTerritory'];
    const territory = typeof rawTerritory === 'string' && rawTerritory.trim() ? rawTerritory.trim() : undefined;

    switch (event.type) {
      case 'NAVIGATE': {
        const target = payload['target']; // es. "PROBLEMS", "PROPOSALS", "Index"

        if (target === 'PROBLEMS') {
          return [{ type: 'NAVIGATE', payload: { path: ['/problems'], ...(territory ? { territory } : {}) } }];
        }
        if (target === 'PROPOSALS') {
          return [{ type: 'NAVIGATE', payload: { path: ['/problems', payload['idProblem'], 'proposals'], ...(territory ? { territory } : {}) } }];
        }
        if (target === 'SCENARIOS') {
          return [{ type: 'NAVIGATE', payload: { path: ['/problems', payload['idProblem'], 'proposals', payload['idProposal'], 'scenari'], ...(territory ? { territory } : {}) } }];
        }
        if (target === 'SCENARIO') {
          return [{ type: 'NAVIGATE', payload: { path: ['/problems', payload['idProblem'], 'proposals', payload['idProposal'], 'scenari', payload['idScenario']], ...(territory ? { territory } : {}) } }];
        }
        if (target === 'Index') {
          // Naviga agli indici passando i filtri come query parameters
          return [{ type: 'NAVIGATE', payload: { path: ['/indici'], queryParams: payload['param'], ...(territory ? { territory } : {}) } }];
        }
        if (Array.isArray(payload['path'])) {
          return [{
            type: 'NAVIGATE',
            payload: {
              path: payload['path'],
              ...(payload['queryParams'] ? { queryParams: payload['queryParams'] } : {}),
              ...(territory ? { territory } : {})
            }
          }];
        }
        break;
      }

      case 'COMPARE_SCENARIO':
        return [{
          type: 'NAVIGATE', payload: {
            path: ['/problems', payload['idProblem'], 'proposals', payload['idProposal'], 'scenari', 'confronta', payload['idScenario1'], payload['idScenario2']],
            ...(territory ? { territory } : {})
          }
        }];

      case 'DELETED': {
        // Se elimini, torni alla lista padre
        const target = payload['target'];
        if (target === 'SCENARIO') {
          return [{ type: 'NAVIGATE', payload: { path: ['/problems', payload['idProblem'], 'proposals', payload['idProposal'], 'scenari'], ...(territory ? { territory } : {}) } }];
        }
        if (target === 'PROPOSTA') {
          return [{ type: 'NAVIGATE', payload: { path: ['/problems', payload['idProblem'], 'proposals'], ...(territory ? { territory } : {}) } }];
        }
        if (target === 'PROBLEMA') {
          return [{ type: 'NAVIGATE', payload: { path: ['/problems'], ...(territory ? { territory } : {}) } }];
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
  async translateForStandalone(event: DomainEvent): Promise<UIAction[]> {
    switch (event.type) {


      case 'SHOW_WIDGET': {
        const widgetName = event.payload['widgetName'];
        let mappedData = event.payload['data'] || {};

        if (widgetName === 'lineChart' || widgetName === 'barChart') {
          const innerPayload = mappedData['payload'] ?? mappedData;
          mappedData = {
            payload: {
              labels: innerPayload.labels || [],
              series: innerPayload.series || [],
              title: innerPayload.title || '',
              unitDescription: innerPayload.unitDescription || '',
              granularity: innerPayload.granularity || 'annuale',
              selectedItems: innerPayload.selectedItems,
              codeToName: innerPayload.codeToName
            }
          };
        }
        if (widgetName === 'histogramComparison') {
          const innerPayload = mappedData['payload'] ?? mappedData;
          const configuration = await firstValueFrom(this.scenarioService.getParsedConfiguration());

          if (innerPayload.scenarioIds && Array.isArray(innerPayload.scenarioIds)) {
            const id1 = innerPayload.scenarioIds[0];
            const id2 = innerPayload.scenarioIds[1];

            const rawData = innerPayload.data || {};
            const k1 = Object.keys(rawData).find(k => k.includes(id1));
            const k2 = Object.keys(rawData).find(k => k.includes(id2));

            const extractKpis = (source: any) => {
              return source?.data || source?.plot_data?.kpis || {};
            };

            const dataLeftRaw = k1 ? extractKpis(rawData[k1]) : {};
            const dataRightRaw = k2 ? extractKpis(rawData[k2]) : {};

            mappedData = {
              payload: {
                labelLeft: innerPayload.labels?.[id1] || 'Scenario 1',
                labelRight: innerPayload.labels?.[id2] || 'Scenario 2',
                dataLeft: getComparisonChartKpis(dataLeftRaw),
                dataRight: getComparisonChartKpis(dataRightRaw)
              },
              kpiMapper: configuration.kpiMapper
            };
          } else {
            mappedData = {
              payload: innerPayload,
              kpiMapper: configuration.kpiMapper
            };
          }
        }
        if (widgetName === 'loadPlot' || widgetName === 'capacityPlot') {
          const innerPayload = mappedData['payload'] ?? mappedData;

          if (innerPayload.scenarioIds && Array.isArray(innerPayload.scenarioIds)) {
            const id1 = innerPayload.scenarioIds[0];
            const rawData = innerPayload.data || {};
            const k1 = Object.keys(rawData).find(k => k.includes(id1));

            if (k1 && rawData[k1]) {
              const scenarioData = rawData[k1];
              const scenarioTitle = innerPayload.title
                || innerPayload.labels?.[id1]
                || scenarioData.name
                || scenarioData.scenario_name
                || '';

              const plotRawData = {
                ...(scenarioData.plot_data || scenarioData),
                kpis: scenarioData.data || scenarioData.kpis || scenarioData.plot_data?.kpis || {},
                points: scenarioData.plot_data?.points || scenarioData.points || {}
              };

              // Recupera config, colorMap e sottosistemi
              const config = await firstValueFrom(this.scenarioService.getConfiguration());
              const meta = (config as any).metadata || config;

              let sottosistemi: any[] = [];
              if (meta.mapper && !Array.isArray(meta.mapper)) {
                sottosistemi = Object.entries(meta.mapper).map(([key, label]) => ({
                  value: key,
                  label: label as string
                }));
              } else {
                sottosistemi = meta.mapper || meta.map || [];
              }

              const colorMap = meta.color_map || [];
              const plotMapper = meta.plot_mapper || {};

              const processedPlotInput = this.plotService.preparePlotInput(
                plotRawData,
                colorMap,
                sottosistemi,
                plotMapper
              );
              const defaultType = widgetName === 'capacityPlot' ? 'mono' : 'bi';

              mappedData = {
                payload: {
                  type: innerPayload.type || defaultType,
                  subsystem: innerPayload.subsystem || 'default',
                  data: processedPlotInput,
                  title: scenarioTitle
                }
              };
            }
          }
        }
        return [{
          type: 'SHOW_WIDGET',
          payload: {
            widgetName,
            data: mappedData
          }
        }];
      }

      default:
        return [];
    }
  }
}
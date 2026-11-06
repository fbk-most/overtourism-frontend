import { PlotInput } from '../models/plot.model';
import { TranslateService } from '@ngx-translate/core';
import { PlotService } from './plot.service';

describe('PlotService', () => {
  let service: PlotService;

  beforeEach(() => {
    service = new PlotService();
  });

  it('uses mapped curve labels and the supplied scenario title', async () => {
    const renderPlot = spyOn(service, 'renderPlot').and.resolveTo();
    const input: PlotInput = {
      curves: [{ name: 'SUSTAINABLE_tourism', x: [], y: [] }],
      points: [],
      mapper: [{ value: 'sustainable tourism', label: 'Turismo sostenibile' }]
    };

    await service.renderFunctionPlot('default', document.createElement('div'), input, 'Scenario test');

    const [, data, layout] = renderPlot.calls.mostRecent().args;
    expect(data[0].name).toBe('Turismo sostenibile');
    expect(layout?.title?.text).toBe('Scenario test');
  });

  it('localizes mapped subsystem and axis labels', async () => {
    const translations: Record<string, string> = {
      'plot.labels.subsystems.parking': 'Parking',
      'plot.labels.axes.tourist': 'Tourists per day',
      'plot.labels.axes.excursionist': 'Hikers per day'
    };
    const translate = jasmine.createSpyObj<TranslateService>('TranslateService', ['instant']);
    translate.instant.and.callFake((key: string) => translations[key] ?? key);
    service = new PlotService(translate);
    const renderPlot = spyOn(service, 'renderPlot').and.resolveTo();
    const input: PlotInput = {
      curves: [{ name: 'parking', x: [], y: [] }],
      points: [],
      mapper: [{ value: 'parking', label: 'Parcheggi' }],
      plotMapper: {
        bidimensional: {
          x: { label: 'Turisti / giorno', field: 'tourist' },
          y: { label: 'Escursionisti / giorno', field: 'excursionist' }
        }
      }
    };

    await service.renderFunctionPlot('default', document.createElement('div'), input);

    const [, data, layout] = renderPlot.calls.mostRecent().args;
    expect(data[0].name).toBe('Parking');
    expect(layout?.xaxis?.title?.text).toBe('Tourists per day');
    expect(layout?.yaxis?.title?.text).toBe('Hikers per day');
  });
});

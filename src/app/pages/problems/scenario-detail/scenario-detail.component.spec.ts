import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthenticationService } from '../../../services/authentication.service';
import { ChatbotContextService } from '../../../services/chatbot/chatbotContext.service';
import { ScenarioService } from '../../../services/scenario.service';

import { ScenarioDetailComponent } from './scenario-detail.component';

describe('ScenarioDetailComponent', () => {
  let component: ScenarioDetailComponent;
  let fixture: ComponentFixture<ScenarioDetailComponent>;
  const routeParams: Record<string, string> = {
    problemId: 'problem-3',
    proposalId: 'proposal-5',
    scenarioId: 'scenario-7'
  };
  const chatbotContext = { setContext: jasmine.createSpy('setContext') };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ScenarioDetailComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (name: string) => routeParams[name] ?? null }
            }
          }
        },
        { provide: ScenarioService, useValue: { getScenarios: () => of([]) } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        { provide: ChatbotContextService, useValue: chatbotContext },
        { provide: AuthenticationService, useValue: { canEdit: () => false } }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScenarioDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exposes business IDs from the active route to page context', () => {
    const entities = fixture.nativeElement.querySelector(
      '[data-assistant-scenario-id]'
    ) as HTMLElement;

    expect(entities.getAttribute('data-assistant-problem-id')).toBe('problem-3');
    expect(entities.getAttribute('data-assistant-proposal-id')).toBe('proposal-5');
    expect(entities.getAttribute('data-assistant-scenario-id')).toBe('scenario-7');
    expect(chatbotContext.setContext).toHaveBeenCalledWith(
      'problem-3',
      'proposal-5',
      ['scenario-7']
    );
  });
});

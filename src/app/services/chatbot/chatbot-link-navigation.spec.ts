import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import {
  containsInternalChatMarkdownLink,
  navigateInternalChatLink
} from './chatbot-link-navigation';

describe('navigateInternalChatLink', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RouterTestingModule] });
    router = TestBed.inject(Router);
  });

  it('detects an internal markdown link so it can avoid automatic navigation actions', () => {
    expect(containsInternalChatMarkdownLink('Per accedere, [clicca qui](/indici).')).toBeTrue();
    expect(containsInternalChatMarkdownLink('[Go](https://example.com/)')).toBeFalse();
  });

  it('uses Angular Router for same-app page links', () => {
    const navigate = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    const anchor = document.createElement('a');
    anchor.href = '/problems/problem-1/proposals/proposal-1/scenari/scenario-1';
    document.body.appendChild(anchor);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    try {
      anchor.dispatchEvent(event);
      navigateInternalChatLink(event, router);

      expect(event.defaultPrevented).toBeTrue();
      expect(navigate).toHaveBeenCalledWith(
        '/problems/problem-1/proposals/proposal-1/scenari/scenario-1'
      );
    } finally {
      anchor.remove();
    }
  });

  it('does not intercept links outside supported internal routes', () => {
    const navigate = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    const anchor = document.createElement('a');
    anchor.href = 'https://example.com/';
    document.body.appendChild(anchor);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    try {
      anchor.dispatchEvent(event);
      navigateInternalChatLink(event, router);

      expect(event.defaultPrevented).toBeFalse();
      expect(navigate).not.toHaveBeenCalled();
    } finally {
      anchor.remove();
    }
  });

  it('updates active territory when link targets a specific territory', () => {
    const navigate = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    const authServiceMock = {
      availableTerritories: ['fazzon', 'molveno'],
      setActiveTerritory: jasmine.createSpy('setActiveTerritory')
    } as any;

    const anchor = document.createElement('a');
    anchor.href = '/problems/molveno_base_problem/proposals/molveno_base_proposal/scenari/molveno_base_scenario';
    document.body.appendChild(anchor);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    try {
      anchor.dispatchEvent(event);
      navigateInternalChatLink(event, router, authServiceMock);

      expect(event.defaultPrevented).toBeTrue();
      expect(authServiceMock.setActiveTerritory).toHaveBeenCalledWith('molveno', false, false);
      expect(navigate).toHaveBeenCalledWith(
        '/problems/molveno_base_problem/proposals/molveno_base_proposal/scenari/molveno_base_scenario'
      );
    } finally {
      anchor.remove();
    }
  });
});

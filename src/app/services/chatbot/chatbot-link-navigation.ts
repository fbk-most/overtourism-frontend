import { Router } from '@angular/router';
import { AuthenticationService } from '../authentication.service';

const INTERNAL_CHAT_ROUTES = [/^\/problems(?:\/|$)/, /^\/indici(?:\/|$)/];

export function containsInternalChatMarkdownLink(markdown: string): boolean {
  return /\]\(\/(?:problems|indici)(?:\/|[?#)])/.test(markdown);
}

export function navigateInternalChatLink(
  event: MouseEvent,
  router: Router,
  authService?: AuthenticationService
): void {
  if (
    event.button !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) return;

  const anchor = target.closest('a[href]');
  if (
    !(anchor instanceof HTMLAnchorElement) ||
    anchor.target.toLowerCase() === '_blank' ||
    anchor.hasAttribute('download')
  ) {
    return;
  }

  const url = new URL(anchor.href, document.baseURI);
  if (
    url.origin !== window.location.origin ||
    !INTERNAL_CHAT_ROUTES.some(route => route.test(url.pathname))
  ) {
    return;
  }

  event.preventDefault();

  if (authService) {
    const territoryParam = url.searchParams.get('territory') || url.searchParams.get('territorio');
    if (territoryParam) {
      authService.setActiveTerritory(territoryParam, false, false);
    } else if (authService.availableTerritories?.length) {
      const pathnameLower = url.pathname.toLowerCase();
      const matched = authService.availableTerritories.find(t => {
        const tLower = t.toLowerCase();
        return (
          pathnameLower.includes(`/${tLower}_`) ||
          pathnameLower.includes(`_${tLower}_`) ||
          pathnameLower.includes(`/${tLower}/`) ||
          pathnameLower.endsWith(`/${tLower}`)
        );
      });
      if (matched) {
        authService.setActiveTerritory(matched, false, false);
      }
    }
  }

  void router.navigateByUrl(`${url.pathname}${url.search}${url.hash}`).catch(error => {
    console.error('Impossibile aprire il collegamento interno della chat:', error);
  });
}

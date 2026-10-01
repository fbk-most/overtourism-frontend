import { Injectable } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs';

export interface Breadcrumb {
  label: string;
  url: string;
}

@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private breadcrumbs$ = new BehaviorSubject<Breadcrumb[]>([]);

  constructor(private router: Router, private route: ActivatedRoute) {
    this.updateBreadcrumbs();

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updateBreadcrumbs();
      });
  }

  get breadcrumbs() {
    return this.breadcrumbs$.asObservable();
  }

  public updateBreadcrumbs(): void {
    const root: ActivatedRoute = this.route.root;
    const breadcrumbs = this.buildBreadcrumbs(root);
    this.breadcrumbs$.next(breadcrumbs);
  }

  private buildBreadcrumbs(
    route: ActivatedRoute,
    url: string = '',
    breadcrumbs: Breadcrumb[] = []
  ): Breadcrumb[] {
    const primaryRoute = route.firstChild;
    if (!primaryRoute) {
      return breadcrumbs;
    }
  
    const routeURL: string = primaryRoute.snapshot.url
      .map(segment => segment.path)
      .join('/');
  
    const nextUrl = routeURL ? `${url}/${routeURL}` : url;
  
    const routeData = primaryRoute.snapshot.data || {};
    const params = primaryRoute.snapshot.params || {};
    
    if (routeData['breadcrumb']) {
      let link = nextUrl;
    
      if (routeData['breadcrumbUrl']) {
        link = this.interpolatePath(routeData['breadcrumbUrl'], params);
      }
    
      breadcrumbs.push({
        label: this.interpolateLabel(routeData['breadcrumb'], params),
        url: link
      });
    }
  
    return this.buildBreadcrumbs(primaryRoute, nextUrl, breadcrumbs);
  }
  
  private interpolatePath(path: string, params: any): string {
    return path.replace(/:([a-zA-Z0-9_]+)/g, (_, key) => params[key] ?? '');
  }

  private interpolateLabel(label: string, params: any): string {
    return label.replace(/:([a-zA-Z0-9_]+)/g, (_, key) => params[key] || key);
  }
}
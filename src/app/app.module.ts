import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { OAuthModule } from 'angular-oauth2-oidc';
import { environment } from '../environments/environment';

// AGID Design
import { DesignAngularKitModule } from 'design-angular-kit';

// Translate
import { HttpClientModule, HttpBackend, HTTP_INTERCEPTORS } from '@angular/common/http';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { MultiTranslateHttpLoader } from 'ngx-translate-multi-http-loader';

// Forms & Modules
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgxSliderModule } from '@angular-slider/ngx-slider';
import { MatDialogModule } from '@angular/material/dialog';
import { AppSideBarModule } from './components/app-side-bar/app-side-bar.module';
import { AppHeaderModule } from './components/app-header/app-header.module';
import { AppFooterModule } from './components/app-footer/app-footer.module';

// Interceptors & Services
import { HttpErrorInterceptor } from './interceptors/http-error.interceptor';
import { TenantInterceptor } from './interceptors/tenant.interceptor';
import { AuthenticationService } from './services/authentication.service';

// Pages & Components
import { HomeComponent } from './pages/home/home.component';
import { ProblemsComponent } from './pages/problems/problems/problems.component';
import { ScenariComponent } from './pages/problems/scenari/scenari.component';
import { PreferitiComponent } from './pages/problems/preferiti/preferiti.component';
import { FaqsComponent } from './pages/faqs/faqs.component';
import { TermsComponent } from './pages/terms/terms.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { ScenarioDetailComponent } from './pages/problems/scenario-detail/scenario-detail.component';
import { PlotComponent } from './components/plot/plot.component';
import { KpiBoxComponent } from './components/plot/kpi-box/kpi-box.component';
import { PlotControlsComponent } from './components/plot/plot-controls/plot-controls.component';
import { AppPlotEditorWidgetComponent } from './components/plot/app-plot-editor-widget/app-plot-editor-widget.component';
import { BreadcrumbsComponent } from './components/breadcrumbs/breadcrumbs.component';
import { ConfrontoScenariComponent } from './pages/problems/confronto-scenari/confronto-scenari.component';
import { BackButtonComponent } from './components/back-button/back-button.component';
import { KpiComparisonComponent } from './components/kpi-comparison/kpi-comparison.component';
import { ProblemCreateComponent } from './pages/problems/problem-create/problem-create.component';
import { ReadingComponent } from './components/plot/reading/reading.component';
import { ProposalCreateComponent } from "./components/app-proposal-create/app-proposal-create.component";
import { ProblemDetailComponent } from './pages/problems/problem-detail/problem-detail.component';
import { ProposalDetailComponent } from './components/proposal-detail/proposal-detail.component';
import { OvertourismChartsComponent } from './components/overtourism-charts/overtourism-charts.component';
import { OvertourismMapComponent } from './components/overtourism-map/overtourism-map.component';
import { ToastComponent } from './components/toast/toast.component';
import { AutocompleteComponent } from './components/autocomplete/autocomplete.component';
import { CapacityComponent } from './pages/overtourism/capacity/capacity.component';
import { FlowsComponent } from './pages/overtourism/flows/flows.component';
import { RedistributionComponent } from './pages/overtourism/redistribution/redistribution.component';
import { HiddenComponent } from './pages/overtourism/hidden/hidden.component';
import { OvertourismComponent } from './pages/overtourism/overtourism/overtourism.component';
import { ProposalDetailPageComponent } from './pages/problems/proposal-detail-page/proposal-detail-page.component';
import { ProposalListPageComponent } from './pages/problems/proposal-list-page/proposal-list-page.component';
import { LoginComponent } from './pages/login/login.component';
import { ChatbotComponent } from './components/chatbot/chatbot-window/chatbot.component';

// Pipes
import { EmptyFieldPipe } from './pipes/empty-field.pipe';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { SharedPlotComponent } from './components/shared/shared-plot/shared-plot.component';
import { HistogramComparisonComponent } from './components/shared/histogram-comparison/histogram-comparison.component';

// Funzioni Factory
export function multiTranslateLoaderFactory(httpBackend: HttpBackend) {
  return new MultiTranslateHttpLoader(httpBackend, [
    { prefix: './assets/i18n/design-angular-kit/', suffix: '.json' },
    { prefix: './assets/i18n/app/', suffix: '.json' }, 
  ]);
}

export function initializeAuth(authService: AuthenticationService) {
  return () => authService.initialLoginSequence();
}

@NgModule({
  declarations: [
    AppComponent, HomeComponent, ProblemsComponent, ScenariComponent, PreferitiComponent,
    FaqsComponent, TermsComponent, SettingsComponent, ScenarioDetailComponent, PlotComponent,
    KpiBoxComponent, PlotControlsComponent, AppPlotEditorWidgetComponent, BreadcrumbsComponent,
    ConfrontoScenariComponent, BackButtonComponent, KpiComparisonComponent, ProblemCreateComponent,
     ReadingComponent, ProposalCreateComponent, ProblemDetailComponent,
    ProposalDetailComponent, ProposalDetailPageComponent, OvertourismComponent, OvertourismChartsComponent, 
    OvertourismMapComponent, ToastComponent, AutocompleteComponent, CapacityComponent, FlowsComponent, 
    RedistributionComponent, HiddenComponent, ProposalListPageComponent, EmptyFieldPipe, LoginComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    AppHeaderModule,
    AppFooterModule,
    AppSideBarModule,
    FormsModule,
    ReactiveFormsModule,
    NgxSliderModule,
    HttpClientModule,
    MatDialogModule,
    ChatbotComponent,
    SharedPlotComponent,
    HistogramComparisonComponent,
    OAuthModule.forRoot({
      resourceServer: {
        allowedUrls: [environment.apiBaseUrl],
        sendAccessToken: true
      }
    }), 
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: multiTranslateLoaderFactory,
        deps: [HttpBackend]
      }
    }),
    DesignAngularKitModule.forRoot({
      translateLoader: (itPrefix: string, itSuffix: string) => ({
        provide: TranslateLoader,
        useFactory: (http: HttpBackend) => new MultiTranslateHttpLoader(http, [
          { prefix: itPrefix, suffix: itSuffix },
          { prefix: './assets/i18n/app/', suffix: '.json' },
        ]),
        deps: [HttpBackend],
      }),
    })
  ],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuth,
      deps: [AuthenticationService],
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: TenantInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: HttpErrorInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { FaqsComponent } from './pages/faqs/faqs.component';
import { PreferitiComponent } from './pages/problems/preferiti/preferiti.component';
import { ProblemsComponent } from './pages/problems/problems/problems.component';
import { ProblemCreateComponent } from './pages/problems/problem-create/problem-create.component';
import { ProblemDetailComponent } from './pages/problems/problem-detail/problem-detail.component';
import { ProposalListPageComponent } from './pages/problems/proposal-list-page/proposal-list-page.component';
import { ProposalDetailPageComponent } from './pages/problems/proposal-detail-page/proposal-detail-page.component';
import { ScenariComponent } from './pages/problems/scenari/scenari.component';
import { ScenarioDetailComponent } from './pages/problems/scenario-detail/scenario-detail.component';
import { ConfrontoScenariComponent } from './pages/problems/confronto-scenari/confronto-scenari.component';

import { CapacityComponent } from './pages/overtourism/capacity/capacity.component';
import { FlowsComponent } from './pages/overtourism/flows/flows.component';
import { HiddenComponent } from './pages/overtourism/hidden/hidden.component';
import { RedistributionComponent } from './pages/overtourism/redistribution/redistribution.component';
import { OvertourismComponent } from './pages/overtourism/overtourism/overtourism.component';

import { UnsavedChangesGuard } from './guards/plot-unsaved-changes.guard';
import { LoginComponent } from './pages/login/login.component';
import { AuthGuard } from './guards/auth.guard';
import { ChatbotStandaloneComponent } from './components/chatbot/chatbot-standalone/chatbot-standalone.component';
import { IndiciComponent } from './pages/indici/indici.component';
import { AgentStatsComponent } from './pages/agent-stats/agent-stats.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },


  {
    path: 'problems',
    data: { breadcrumb: 'Analisi' },
    canActivate: [AuthGuard],
    children: [
      {
        path: '',
        component: ProblemsComponent,
        canActivate: [AuthGuard]
      },
      {
        path: 'create',
        component: ProblemCreateComponent,
        data: { breadcrumb: 'Nuova analisi' },
        canActivate: [AuthGuard]
      },
      {
        path: ':problemId',
        component: ProblemDetailComponent,
        data: {
          breadcrumb: 'Dettaglio analisi',
          breadcrumbUrl: '/problems/:problemId'
        },
        canActivate: [AuthGuard]
      },
      {
        path: ':problemId/proposals',
        data: { breadcrumb: 'Proposte', breadcrumbUrl: '/problems/:problemId' },
        canActivate: [AuthGuard],
        children: [
          {
            path: '',
            component: ProposalListPageComponent,
            data: { breadcrumb: 'Lista proposte', breadcrumbUrl: '/problems/:problemId/proposals' },
            canActivate: [AuthGuard]
          },
          {
            path: ':proposalId',
            component: ProposalDetailPageComponent,
            data: {
              breadcrumb: 'Dettaglio proposta',
              breadcrumbUrl: '/problems/:problemId/proposals/:proposalId'
            },
            canActivate: [AuthGuard]
          },
          {
            path: ':proposalId/scenari',
            data: {
              breadcrumb: 'Scenari',
              breadcrumbUrl: '/problems/:problemId/proposals/:proposalId'
            },
            canActivate: [AuthGuard],
            children: [
              {
                path: '',
                component: ScenariComponent,
                data: { breadcrumb: 'Lista scenari', breadcrumbUrl: '/problems/:problemId/proposals/:proposalId/scenari' },
                canActivate: [AuthGuard]
              },
              {
                path: 'confronta/:id1/:id2',
                component: ConfrontoScenariComponent,
                data: { breadcrumb: 'Confronto scenari' },
                canActivate: [AuthGuard]
              },
              {
                path: ':scenarioId',
                component: ScenarioDetailComponent,
                canDeactivate: [UnsavedChangesGuard],
                data: {
                  breadcrumb: 'Dettaglio scenario',
                  breadcrumbUrl: '/problems/:problemId/proposals/:proposalId/scenari/:scenarioId'
                },
                canActivate: [AuthGuard]
              }
            ]
          }
        ]
      },
      {
        path: 'preferiti',
        component: PreferitiComponent,
        data: { breadcrumb: 'Preferiti', breadcrumbUrl: '/problems/preferiti' },
        canActivate: [AuthGuard]
      },



    ]
  }
  ,
  { path: 'agent', 
    component: ChatbotStandaloneComponent, 
    canActivate: [AuthGuard] },
    //indici
  { path: 'indici', component: IndiciComponent, canActivate: [AuthGuard] },
  // 🔹 Altre sezioni del portale ()
  { path: 'agent-stats', component: AgentStatsComponent, canActivate: [AuthGuard] },
  { path: 'faqs', component: FaqsComponent, data: { breadcrumb: 'FAQ' }, canActivate: [AuthGuard] },
  { path: '', redirectTo: 'problems', pathMatch: 'full' },
  { path: '**', redirectTo: 'problems' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }

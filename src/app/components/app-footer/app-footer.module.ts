import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppFooterComponent } from './app-footer.component';
import { DesignAngularKitModule } from 'design-angular-kit';
import { TranslateModule } from '@ngx-translate/core';
import { TermsComponent } from '../../pages/terms/terms.component';

@NgModule({
  declarations: [AppFooterComponent, TermsComponent],
  imports: [CommonModule, DesignAngularKitModule, TranslateModule.forRoot(),
  ],
  exports: [AppFooterComponent]
})
export class AppFooterModule {}
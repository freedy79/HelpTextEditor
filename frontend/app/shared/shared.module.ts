import { ImageDefault } from './directives/img.directive';
import { NgModule } from '@angular/core';
import { FileIOService } from './services/file-io.service';
import { QtfTranslationPipe } from './pipes/wildcard.pipe';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { NoCacheHeadersInterceptor } from './directives/nocache.directive';

@NgModule({
  declarations: [
    ImageDefault,
    QtfTranslationPipe
  ],
  imports: [
  ],
  exports: [
    ImageDefault,
    QtfTranslationPipe
  ],
  providers: [
    FileIOService,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: NoCacheHeadersInterceptor,
      multi: true
    }
  ],
  bootstrap: []
})
export class SharedModule { }

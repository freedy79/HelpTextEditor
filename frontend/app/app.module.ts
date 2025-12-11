import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AppComponent } from './app.component';
import { SharedModule } from './shared/shared.module';
import { TranslateModule } from '@ngx-translate/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MainModule } from './modules/main/main.module';
import { DialogsModule } from './dialogs/dialogs.module';

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    MainModule,
    DialogsModule,
    BrowserModule,
    HttpClientModule,
    FormsModule,
    SharedModule,
    TranslateModule.forRoot(),
    MatDialogModule,
    MatIconModule,
    BrowserAnimationsModule,
  ],
  exports: [
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
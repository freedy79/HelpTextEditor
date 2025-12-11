
import { NgModule } from '@angular/core';
import { MainComponent } from './main.component';
import { ComponentsModule } from '~/app/components/components.module';
import { DialogsModule } from '~/app/dialogs/dialogs.module';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '~/app/shared/shared.module';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  declarations: [
    MainComponent
  ],
  imports: [
    ComponentsModule,
    DialogsModule,
    BrowserModule,
    CommonModule,
    MatDialogModule,
    MatIconModule,
    FormsModule,
    SharedModule,
    HttpClientModule
  ],
  exports: [
    MainComponent
  ],
  providers: [

  ],
  bootstrap: [MainComponent]
})
export class MainModule { }

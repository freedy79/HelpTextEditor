
import { NgModule } from '@angular/core';
import { FileUploadOverlayComponent } from './file-upload-overlay/file-upload-overlay.component';
import { AddContentOverlayComponent } from './add-content-overlay/add-content-overlay.component';
import { ImagePickerDialogComponent } from './image-picker-dialog/image-picker-dialog.component';
import { ConfirmationDialogComponent } from './confirmation-dialog/confirmation-dialog.component';
import { ConfirmDialogService } from './confirmation-dialog/confirmation-dialog.service';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { DeeplSettingsDialogComponent } from './deepl-settings-dialog/deepl-settings-dialog.component';
import { CleanQtfDialogComponent } from './clean-qtf-dialog/clean-qtf-dialog.component';

@NgModule({
  declarations: [
    FileUploadOverlayComponent,
    AddContentOverlayComponent,
    ImagePickerDialogComponent,
    ConfirmationDialogComponent,
    DeeplSettingsDialogComponent,
    CleanQtfDialogComponent
  ],
  imports: [
    BrowserModule,
    CommonModule,
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    FormsModule
  ],
  exports: [
    FileUploadOverlayComponent,
    AddContentOverlayComponent,
    ImagePickerDialogComponent,
    ConfirmationDialogComponent,
    DeeplSettingsDialogComponent,
    CleanQtfDialogComponent
  ],
  providers: [ConfirmDialogService],
  entryComponents:[ImagePickerDialogComponent, ConfirmationDialogComponent, CleanQtfDialogComponent],
  bootstrap: []
})
export class DialogsModule { }

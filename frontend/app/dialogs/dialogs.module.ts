
import { NgModule } from '@angular/core';
import { FileUploadOverlayComponent } from './file-upload-overlay/file-upload-overlay.component';
import { AddContentOverlayComponent } from './add-content-overlay/add-content-overlay.component';
import { ImagePickerDialogComponent } from './image-picker-dialog/image-picker-dialog.component';
import { ConfirmationDialogComponent } from './confirmation-dialog/confirmation-dialog.component';
import { ConfirmDialogService } from './confirmation-dialog/confirmation-dialog.service';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';

@NgModule({
  declarations: [
    FileUploadOverlayComponent,
    AddContentOverlayComponent,
    ImagePickerDialogComponent,
    ConfirmationDialogComponent
  ],
  imports: [
    BrowserModule,
    CommonModule,
    MatDialogModule,
    MatIconModule,
    FormsModule
  ],
  exports: [
    FileUploadOverlayComponent,
    AddContentOverlayComponent,
    ImagePickerDialogComponent,
    ConfirmationDialogComponent
  ],
  providers: [ConfirmDialogService],
  entryComponents:[ImagePickerDialogComponent, ConfirmationDialogComponent],
  bootstrap: []
})
export class DialogsModule { }

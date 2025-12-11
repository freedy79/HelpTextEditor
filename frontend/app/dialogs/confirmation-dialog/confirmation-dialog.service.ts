// Beispiel: confirm-dialog.service.ts (oder in der gleichen Komponente)
import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmationDialogComponent } from './confirmation-dialog.component';

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  constructor(private dialog: MatDialog) {}

  openConfirmDialog(elementName: string): Promise<string> {
    return new Promise(resolve => {
      const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
        width: '600px',
        data: { elementName },
      });

      dialogRef.afterClosed().subscribe(result => {
        // 'result' hier => 'yes', 'no' oder 'cancel'
        resolve(result);
      });
    });
  }
}

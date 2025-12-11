import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-confirm-dialog',
  template: `
    <h2 mat-dialog-title>
      Element {{ data.elementName }} is not referenced in structure
    </h2>

    <mat-dialog-content>
      <p>Do you want to delete it?</p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onYes()">Yes</button>
      <button mat-button (click)="onNo()">No</button>
      <button mat-button mat-dialog-close (click)="onCancel()">Cancel</button>
    </mat-dialog-actions>
  `
})
export class ConfirmationDialogComponent {
  constructor(
    private dialog: MatDialog,
    private dialogRef: MatDialogRef<ConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { elementName: string }
  ) {}

  onYes(): void {
    this.dialogRef.close('yes');
  }

  onNo(): void {
    this.dialogRef.close('no');
  }

  onCancel(): void {
    this.dialogRef.close('cancel');
  }

  openConfirmDialog(elementName: string): Promise<string> {
    return new Promise(resolve => {
      const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
        data: { elementName },
      });

      dialogRef.afterClosed().subscribe(result => {
        // 'result' hier => 'yes', 'no' oder 'cancel'
        resolve(result);
      });
    });
  }
}

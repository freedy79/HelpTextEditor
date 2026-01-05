import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface DeeplSettingsDialogData {
  token: string;
  rememberToken: boolean;
}

export interface DeeplSettingsDialogResult {
  token: string;
  rememberToken: boolean;
  clearToken?: boolean;
}

@Component({
  selector: 'app-deepl-settings-dialog',
  templateUrl: './deepl-settings-dialog.component.html',
  styleUrls: ['./deepl-settings-dialog.component.scss']
})
export class DeeplSettingsDialogComponent {
  token: string;
  rememberToken: boolean;
  showToken = false;

  constructor(
    private dialogRef: MatDialogRef<DeeplSettingsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DeeplSettingsDialogData
  ) {
    this.token = data?.token || '';
    this.rememberToken = data?.rememberToken ?? true;
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    this.dialogRef.close({
      token: this.token.trim(),
      rememberToken: this.rememberToken
    } as DeeplSettingsDialogResult);
  }

  clearToken(): void {
    this.dialogRef.close({
      token: '',
      rememberToken: false,
      clearToken: true
    } as DeeplSettingsDialogResult);
  }
}

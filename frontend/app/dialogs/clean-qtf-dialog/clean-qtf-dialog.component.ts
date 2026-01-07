import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Languages, QtfFile } from '../../models/qtf-file.model';

export interface CleanQtfDialogData {
  unusedKeys: string[];
  qtfFile: QtfFile | null;
}

export interface CleanQtfDialogResult {
  deletedKeys: string[];
  cancelled: boolean;
}

@Component({
  selector: 'app-clean-qtf-dialog',
  templateUrl: './clean-qtf-dialog.component.html',
  styleUrls: ['./clean-qtf-dialog.component.scss']
})
export class CleanQtfDialogComponent {
  currentIndex = 0;
  deletedKeys: string[] = [];

  constructor(
    private dialogRef: MatDialogRef<CleanQtfDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CleanQtfDialogData
  ) { }

  get hasUnusedKeys(): boolean {
    return !!this.data?.unusedKeys?.length;
  }

  get totalCount(): number {
    return this.data?.unusedKeys?.length || 0;
  }

  get currentKey(): string | null {
    if (!this.hasUnusedKeys || this.currentIndex >= this.totalCount) {
      return null;
    }
    return this.data.unusedKeys[this.currentIndex];
  }

  get currentTranslationPreview(): string | null {
    if (!this.currentKey) {
      return null;
    }

    const entry = this.data.qtfFile?.TEXTS?.[this.currentKey];
    const fallbackText = 'Eintrag ist leer';
    if (!entry?.TRANSLATIONS) {
      return fallbackText;
    }

    const preferredLanguages = [Languages.ENGLISH, Languages.GERMAN, Languages.FRENCH];
    for (const language of preferredLanguages) {
      const translation = entry.TRANSLATIONS[language];
      if (translation && translation.trim().length > 0) {
        return translation;
      }
    }

    return fallbackText;
  }

  keep(): void {
    this.moveToNext();
  }

  delete(): void {
    if (this.currentKey) {
      this.deletedKeys.push(this.currentKey);
    }
    this.moveToNext();
  }

  cancel(): void {
    this.dialogRef.close({
      deletedKeys: this.deletedKeys,
      cancelled: true
    } as CleanQtfDialogResult);
  }

  closeInfo(): void {
    this.dialogRef.close({
      deletedKeys: [],
      cancelled: false
    } as CleanQtfDialogResult);
  }

  private moveToNext(): void {
    this.currentIndex++;
    if (this.currentIndex >= this.totalCount) {
      this.dialogRef.close({
        deletedKeys: this.deletedKeys,
        cancelled: false
      } as CleanQtfDialogResult);
    }
  }
}

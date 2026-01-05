import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AbbreviationItem } from '~/app/models/help-text-structure.model';

export interface AbbreviationDialogData {
  abbreviation?: AbbreviationItem;
  existingAbbreviations: AbbreviationItem[];
}

export interface AbbreviationDialogResult {
  abbreviation: AbbreviationItem;
}

@Component({
  selector: 'app-abbreviation-dialog',
  templateUrl: './abbreviation-dialog.component.html',
  styleUrls: ['./abbreviation-dialog.component.scss']
})
export class AbbreviationDialogComponent {
  title: string;
  abbreviation = '';
  shortDescription = '';
  longDescription = '';
  useReference = false;
  referenceAbbreviation = '';
  existingAbbreviations: AbbreviationItem[] = [];

  constructor(
    private dialogRef: MatDialogRef<AbbreviationDialogComponent, AbbreviationDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: AbbreviationDialogData
  ) {
    this.existingAbbreviations = data?.existingAbbreviations || [];
    if (data?.abbreviation) {
      this.applyAbbreviation(data.abbreviation);
    }
    this.title = data?.abbreviation ? 'Abkürzung bearbeiten' : 'Neue Abkürzung';
  }

  get referenceOptions(): AbbreviationItem[] {
    return this.existingAbbreviations
      .filter(abbr => !this.data?.abbreviation || abbr.abbreviation !== this.data.abbreviation.abbreviation);
  }

  get canSave(): boolean {
    const hasAbbreviation = !!this.abbreviation.trim();
    if (!hasAbbreviation) {
      return false;
    }

    if (this.useReference) {
      return !!this.referenceAbbreviation;
    }

    return !!this.shortDescription.trim() && !!this.longDescription.trim();
  }

  onUseReferenceChange(event: any): void {
    this.useReference = !!event?.target?.checked;
    if (!this.useReference) {
      this.referenceAbbreviation = '';
    } else if (this.referenceAbbreviation) {
      this.onReferenceChanged(this.referenceAbbreviation);
    }
  }

  onReferenceChanged(reference: string): void {
    this.referenceAbbreviation = reference;
    if (!reference) {
      return;
    }

    const existing = this.existingAbbreviations.find(item => item.abbreviation === reference);
    if (existing) {
      this.shortDescription = existing.shortDescription || '';
      this.longDescription = existing.longDescription || '';
    }
  }

  save(): void {
    if (!this.canSave) { return; }

    const abbreviationItem: AbbreviationItem = {
      abbreviation: this.abbreviation.trim(),
      shortDescription: this.shortDescription.trim(),
      longDescription: this.longDescription.trim(),
      referenceAbbreviation: undefined
    };

    if (this.useReference && this.referenceAbbreviation) {
      abbreviationItem.referenceAbbreviation = this.referenceAbbreviation;
    }

    this.dialogRef.close({ abbreviation: abbreviationItem });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  private applyAbbreviation(abbreviation: AbbreviationItem): void {
    this.abbreviation = abbreviation.abbreviation || '';
    this.shortDescription = abbreviation.shortDescription || '';
    this.longDescription = abbreviation.longDescription || '';
    if (abbreviation.referenceAbbreviation) {
      this.referenceAbbreviation = abbreviation.referenceAbbreviation;
      this.useReference = true;
    }
  }
}

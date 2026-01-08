import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CoverageReport } from '~/app/models/coverage-report.model';

export interface CoverageDialogData {
  coverageReport: CoverageReport | null;
}

@Component({
  selector: 'app-coverage-dialog',
  templateUrl: './coverage-dialog.component.html',
  styleUrls: ['./coverage-dialog.component.scss']
})
export class CoverageDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: CoverageDialogData) {}

  hasMissingTranslations(coverage: CoverageReport | null): boolean {
    return Boolean(coverage?.missingTranslations?.some((report) => report.missing.length));
  }
}

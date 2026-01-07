import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-statusbar',
  templateUrl: './statusbar.component.html',
  styleUrls: ['./statusbar.component.scss']
})
export class StatusbarComponent {
  @Input() selectedTopLevelKey: string | null = null;
  @Input() language: string | null = null;
  @Input() isDirty = false;
  @Input() version: string | null = null;
  @Input() translationIdCount: number | null = null;

  get statusLabel(): string {
    if (this.isDirty) {
      return 'Unsaved changes';
    }

    return 'All changes saved';
  }

  get topLevelLabel(): string {
    return this.selectedTopLevelKey || 'No file loaded';
  }

  get versionLabel(): string {
    return this.version || 'Not set';
  }

  get translationIdCountLabel(): string {
    if (this.translationIdCount === null || this.translationIdCount === undefined) {
      return 'Not available';
    }

    return String(this.translationIdCount);
  }
}

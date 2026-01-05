import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-statusbar',
  templateUrl: './statusbar.component.html',
  styleUrls: ['./statusbar.component.scss']
})
export class StatusbarComponent {
  @Input() selectedTopLevelKey: string | null = null;
  @Input() selectedSectionId: string | null = null;
  @Input() language: string | null = null;
  @Input() isDirty = false;

  get statusLabel(): string {
    if (this.isDirty) {
      return 'Unsaved changes';
    }

    return 'All changes saved';
  }

  get topLevelLabel(): string {
    return this.selectedTopLevelKey || 'No file loaded';
  }

  get sectionLabel(): string {
    return this.selectedSectionId || 'No selection';
  }
}

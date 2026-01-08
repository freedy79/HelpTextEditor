import { Component, EventEmitter, Output, ViewChild, ElementRef } from '@angular/core';
import { HelpContentType } from '~models/help-text-structure.model';

@Component({
  selector: 'app-add-content-overlay',
  templateUrl: './add-content-overlay.component.html',
  styleUrls: ['./add-content-overlay.component.scss']
})
export class AddContentOverlayComponent {
  @Output() closeOverlay = new EventEmitter<{
    cancelled: boolean;
    type?: HelpContentType;
    insertPosition?: string;
  }>();

  public contentType = HelpContentType.INSTRUCTION;
  public insertPosition = 'after';

  public contentTypes = [
    HelpContentType.INSTRUCTION,
    HelpContentType.INSTRUCTION_BOLD,
    HelpContentType.BULLET_ENUMERATION,
    HelpContentType.ENUMERATION,
    HelpContentType.IMAGE,
    HelpContentType.SPLITIMAGE,
    HelpContentType.TABLE
  ];

  onOk() {
    console.log('contentType ', this.contentType, ' - ', this.insertPosition);
    this.closeOverlay.emit({
      cancelled: false,
      type: this.contentType,
      insertPosition: this.insertPosition
    });
  }

  onCancel() {
    this.closeOverlay.emit({ cancelled: true });
  }
}

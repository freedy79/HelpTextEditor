import { Component, EventEmitter, Output, ViewChild, ElementRef } from '@angular/core';

@Component({
  selector: 'app-add-content-overlay',
  templateUrl: './add-content-overlay.component.html',
  styleUrls: ['./add-content-overlay.component.scss']
})
export class AddContentOverlayComponent {
  @Output() closeOverlay = new EventEmitter<{
    cancelled: boolean;
    type?: string;
    insertPosition?: string;
  }>();

  public contentType: string = "INSTRUCTION";
  public insertPosition: string = "after";

  public contentTypes = [
    "INSTRUCTION", "INSTRUCTION_BOLD", "BULLET_ENUMERATION", "ENUMERATION", "IMAGE", "SPLITIMAGE", "TABLE"
  ]

  onOk() {
    console.log("contentType ", this.contentType, " - ", this.insertPosition);
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

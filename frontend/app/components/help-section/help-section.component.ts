import { Component, EventEmitter, HostBinding, Input, OnChanges, Output } from '@angular/core';
import { ImageDefault } from '~shared/directives/img.directive';
import { HelpTextSection } from '~models/help-text-structure.model';

@Component({
  selector: 'app-help-section, json-pipe',
  templateUrl: './help-section.component.html',
  styleUrls: ['./help-section.component.scss'],
  viewProviders: [ImageDefault]
})
export class HelpSectionComponent implements OnChanges {
  @Input() section: HelpTextSection;
  @Input() sectionNumber: String;
  @Input() sectionLevel: number;
  @Input() selectedHelpSection: HelpTextSection;
  @Output() onSelectContent = new EventEmitter<string>();
  @Input() selectedLanguage: String;

  @Input() language: String;
  

  constructor() {
    if (this.language === undefined) {
      this.language = 'EN';
    }

    if (this.sectionNumber === undefined) {
      this.sectionNumber = '';
    }

    if (this.sectionLevel === undefined) {
      this.sectionLevel = 1;
    }
  }

  ngOnChanges() {
  }

  errorHandler(event) {
    console.debug(event);
  }

  onImgError(event, content) {
    // react on    (error)="onImgError($event, content)"
    //console.log(JSON.stringify(content));
    event.target.src = '';
  }

  public forwardSectionClick(contentId) {
    //console.log("forwardSectionClick ", contentId);
    if (this.onSelectContent) {
      this.onSelectContent.emit(contentId);
    }
  }

  public contentClick(contentId) {
    this.forwardSectionClick(contentId);
  }

  public isSelected(section) {
    if ((section != undefined) && this.selectedHelpSection) {
      const selected = section.value == this.selectedHelpSection.value;
      //console.log("Selected: ", this.selectedHelpSection.value, " you asked for: ", section.value);
      return selected;
    }
    //console.log("section: ", section != null);
    //console.log("selectedHelpSection: ", this.selectedHelpSection != null);
    return false;
  }

  public isIeOrEdge() {
    const agent = window.navigator.userAgent.toLowerCase()
    //console.log("isEdge: ", agent);
    const isIEOrEdge = agent.indexOf('edg') > -1;
    return isIEOrEdge;
  }
}

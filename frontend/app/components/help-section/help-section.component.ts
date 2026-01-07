import { Component, EventEmitter, HostBinding, Input, OnChanges, Output } from '@angular/core';
import { ImageDefaultDirective } from '~shared/directives/img.directive';
import { HelpTextSection, TableCellSelection } from '~models/help-text-structure.model';

@Component({
  selector: 'app-help-section, json-pipe',
  templateUrl: './help-section.component.html',
  styleUrls: ['./help-section.component.scss'],
  viewProviders: [ImageDefaultDirective]
})
export class HelpSectionComponent implements OnChanges {
  @Input() section: HelpTextSection;
  @Input() sectionNumber: String;
  @Input() sectionLevel: number;
  @Input() selectedHelpSection: HelpTextSection;
  @Input() selectedContentKey: string | null = null;
  @Input() selectedTableCell: TableCellSelection | null = null;
  @Output() selectContent = new EventEmitter<string | TableCellSelection>();
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

  onImgError(event, content) {
    // react on    (error)="onImgError($event, content)"
    // console.log(JSON.stringify(content));
    event.target.src = '';
  }

  public forwardSectionClick(contentId) {
    // console.log("forwardSectionClick ", contentId);
    if (this.selectContent) {
      this.selectContent.emit(contentId);
    }
  }

  public contentClick(contentId) {
    this.forwardSectionClick(contentId);
  }

  public tableCellClick(
    cellKey: string,
    tableId: string,
    colIndex: number,
    rowIndex?: number,
    isHeader = false
  ) {
    this.forwardSectionClick({
      tableId,
      rowIndex,
      colIndex,
      isHeader,
      key: cellKey
    } as TableCellSelection);
  }

  public isSelected(section) {
    if (section && this.selectedHelpSection) {
      return section.value === this.selectedHelpSection.value;
    }
    // console.log("section: ", section != null);
    // console.log("selectedHelpSection: ", this.selectedHelpSection != null);
    return false;
  }

  public isTableCellSelected(
    cellKey: string,
    tableId: string,
    rowIndex: number | undefined,
    colIndex: number,
    isHeader = false
  ): boolean {
    if (!this.selectedTableCell) {
      return false;
    }

    return this.selectedTableCell.tableId === tableId
      && this.selectedTableCell.isHeader === isHeader
      && this.selectedTableCell.colIndex === colIndex
      && (this.selectedTableCell.rowIndex ?? null) === (rowIndex ?? null)
      && this.selectedTableCell.key === cellKey;
  }

  public isIeOrEdge() {
    const agent = window.navigator.userAgent.toLowerCase();
    // console.log("isEdge: ", agent);
    const isIEOrEdge = agent.indexOf('edg') > -1;
    return isIEOrEdge;
  }
}

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MainHelpSection, HelpTextSection, HelpContentType, HelpTextStep } from '~models/help-text-structure.model';

@Component({
  selector: 'app-help-structure-treeview',
  templateUrl: './help-structure-treeview.component.html',
  styleUrls: ['./help-structure-treeview.component.scss'],
})
export class HelpStructureTreeviewComponent {
  @Input() helpItem: MainHelpSection;
  @Input() selectedHelpSection: HelpTextSection;
  @Output() onItemClicked: EventEmitter<any> = new EventEmitter();
  @Output() addSubsection: EventEmitter<HelpTextSection> = new EventEmitter();
  @Output() addContent: EventEmitter<HelpTextSection | MainHelpSection> = new EventEmitter();
  @Output() addStep: EventEmitter<HelpTextSection> = new EventEmitter();
  @Output() deleteSection: EventEmitter<HelpTextSection | HelpTextStep> = new EventEmitter();
  @Output() moveSection: EventEmitter<{ parent: HelpTextSection | MainHelpSection; container: string; index: number; direction: 'up' | 'down' }>
    = new EventEmitter();

  private expandedSections: string[];

  constructor() {
    this.expandedSections = [];
  }

  getSelectedItem(): MainHelpSection {
    return this.helpItem;
  }

  public onSelectTreeItem(event) {
    if (this.onItemClicked) {
      //console.log("click ", event);
      this.onItemClicked.emit(event);
    }
  }

  public onAddSubsection(section: HelpTextSection) {
    this.addSubsection.emit(section);
  }

  public onAddContent(section: HelpTextSection | MainHelpSection) {
    this.addContent.emit(section);
  }

  public onAddStep(section: HelpTextSection) {
    this.addStep.emit(section);
  }

  public onDeleteSection(section: HelpTextSection | HelpTextStep) {
    this.deleteSection.emit(section);
  }

  public onMove(parent: HelpTextSection | MainHelpSection, container: string, index: number, direction: 'up' | 'down') {
    this.moveSection.emit({ parent, container, index, direction });
  }

  public getMarginLeft(level: number) {
    let calc_margin = (level - 1) * 20;

    let styles = {
      'margin-left': calc_margin + 'px',
    };

    return styles;
  }

  hasChildren(section) {
    if (section instanceof HelpTextSection) {
      return (section as HelpTextSection).hasChildren();
    }

    return false;
  }

  onOpenCloseSection(section) {
    if (this.expandedSections.find(x => x === section)) {
      //console.log("closing ", section);
      this.expandedSections = this.expandedSections.filter(item => item !== section);
    } else {
      //console.log("expanding ", section);
      this.expandedSections.push(section);
    }

  }

  getItemExpanded(section) {
    if (section) {
      //console.log("expanded? ", section.value);
      if (section.value) {
        return (this.expandedSections.find(x => x === section.value));
      } else 
      {
        return (this.expandedSections.find(x => x === section.value))
      }
    }
    return false;
  }

  isSelectedSection(section) {
    if (this.selectedHelpSection && section) {
      //console.log("isSelected", this.selectedHelpSection.value);
      return (this.selectedHelpSection.value == section.value);
    } else return false;
  }

  showStepControls(section: HelpTextSection): boolean {
    return section && (section.type === HelpContentType.ENUMERATION || section.type === HelpContentType.BULLET_ENUMERATION);
  }

  isHelpTextSection(item: HelpTextSection | HelpTextStep): item is HelpTextSection {
    return item instanceof HelpTextSection;
  }
}

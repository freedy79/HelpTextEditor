import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { MainHelpSection, HelpTextSection, HelpContentType, HelpTextStep } from '~models/help-text-structure.model';
import { ContextMenuComponent, ContextMenuItem } from '../context-menu/app-context-menu.component';

type ParentType = HelpTextSection | MainHelpSection | HelpTextStep;

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
  @Output() moveSection: EventEmitter<{ parent: ParentType; container: string; index: number; direction: 'up' | 'down' }>
    = new EventEmitter();

  @ViewChild('contextMenu') contextMenu: ContextMenuComponent;

  contextMenuItems: ContextMenuItem[] = [];
  private contextMenuContext: { section: HelpTextSection | HelpTextStep; parent: ParentType; container: string; index: number; } | null = null;

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

  public onMove(parent: ParentType, container: string, index: number, direction: 'up' | 'down') {
    this.moveSection.emit({ parent, container, index, direction });
  }

  openContextMenu(event: MouseEvent, section: HelpTextSection | HelpTextStep, parent: ParentType, container: string, index: number) {
    event.preventDefault();
    event.stopPropagation();

    this.contextMenuContext = { section, parent, container, index };
    this.contextMenuItems = this.buildContextMenuItems(section, parent, container, index);

    if (this.contextMenu) {
      this.contextMenu.openContextMenu(event.clientX, event.clientY, this.contextMenuItems);
    }
  }

  private buildContextMenuItems(section: HelpTextSection | HelpTextStep, parent: ParentType, container: string, index: number): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];
    const hasContainer = !!container && !!parent && !!(parent as any)[container];
    const collection = hasContainer ? (parent as any)[container] as any[] : [];

    items.push({ label: 'Move up', action: 'moveUp', disabled: !hasContainer || index === 0 });
    items.push({ label: 'Move down', action: 'moveDown', disabled: !hasContainer || index >= collection.length - 1 });

    if (this.isHelpTextSection(section)) {
      items.push({ label: 'Add subsection', action: 'addSubsection' });
      items.push({ label: 'Add content', action: 'addContent' });
      if (this.showStepControls(section)) {
        items.push({ label: 'Add step', action: 'addStep' });
      }
    }

    items.push({ label: 'Delete', action: 'delete' });

    return items;
  }

  onContextMenuAction(action: string) {
    if (!this.contextMenuContext) { return; }

    const { section, parent, container, index } = this.contextMenuContext;

    switch (action) {
      case 'moveUp':
        this.onMove(parent, container, index, 'up');
        break;
      case 'moveDown':
        this.onMove(parent, container, index, 'down');
        break;
      case 'addSubsection':
        if (this.isHelpTextSection(section)) { this.onAddSubsection(section); }
        break;
      case 'addContent':
        if (this.isHelpTextSection(section)) { this.onAddContent(section); }
        break;
      case 'addStep':
        if (this.isHelpTextSection(section)) { this.onAddStep(section); }
        break;
      case 'delete':
        this.onDeleteSection(section);
        break;
      default:
        break;
    }

    this.contextMenuContext = null;
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

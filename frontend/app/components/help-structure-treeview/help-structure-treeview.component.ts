import { CdkDragDrop, CdkDragEnter, CdkDragExit, CdkDragStart } from '@angular/cdk/drag-drop';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { MainHelpSection, HelpTextSection, HelpContentType, HelpTextStep, AbbreviationItem } from '~models/help-text-structure.model';
import { ContextMenuComponent, ContextMenuItem } from '../context-menu/app-context-menu.component';

type ParentType = HelpTextSection | MainHelpSection | HelpTextStep;
type TreeItem = HelpTextSection | HelpTextStep | AbbreviationItem | null;
type MoveEvent = {
  parent: ParentType;
  container: string;
  index: number;
  direction?: 'up' | 'down';
  newIndex?: number;
  fromParent?: ParentType;
  fromContainer?: string;
};
type DropContainerContext = { parent: ParentType; container: string; mode?: 'list' | 'child' };

@Component({
  selector: 'app-help-structure-treeview',
  templateUrl: './help-structure-treeview.component.html',
  styleUrls: ['./help-structure-treeview.component.scss'],
})
export class HelpStructureTreeviewComponent implements OnChanges {
  @Input() helpItem: MainHelpSection;
  @Input() topLevelKey: string;
  @Input() selectedHelpSection: HelpTextSection;
  @Output() onItemClicked: EventEmitter<any> = new EventEmitter();
  @Output() addSubsection: EventEmitter<HelpTextSection> = new EventEmitter();
  @Output() addContent: EventEmitter<HelpTextSection | MainHelpSection> = new EventEmitter();
  @Output() addStep: EventEmitter<HelpTextSection> = new EventEmitter();
  @Output() deleteSection: EventEmitter<HelpTextSection | HelpTextStep> = new EventEmitter();
  @Output() moveSection: EventEmitter<MoveEvent> = new EventEmitter();
  @Output() addAbbreviation: EventEmitter<MainHelpSection> = new EventEmitter();
  @Output() editAbbreviation: EventEmitter<{ abbreviation: AbbreviationItem; parent: MainHelpSection; index: number; }> = new EventEmitter();
  @Output() deleteAbbreviation: EventEmitter<{ abbreviation: AbbreviationItem; parent: MainHelpSection; }> = new EventEmitter();

  @ViewChild('contextMenu') contextMenu: ContextMenuComponent;

  contextMenuItems: ContextMenuItem[] = [];
  private contextMenuContext: { section: TreeItem; parent: ParentType; container: string; index: number; } | null = null;

  private expandedSections: string[];
  private activeDropListId: string | null = null;

  constructor() {
    this.expandedSections = [];
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['topLevelKey'] && !changes['topLevelKey'].firstChange
      && changes['topLevelKey'].currentValue !== changes['topLevelKey'].previousValue) {
      this.expandedSections = [];
    }

    if (this.selectedHelpSection?.value) {
      this.expandToSelectedSection(this.selectedHelpSection.value);
    }
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

  public onAddAbbreviation(mainSection: MainHelpSection) {
    this.addAbbreviation.emit(mainSection);
  }

  public onEditAbbreviation(abbreviation: AbbreviationItem, parent: MainHelpSection, index: number) {
    this.editAbbreviation.emit({ abbreviation, parent, index });
  }

  public onDeleteAbbreviation(abbreviation: AbbreviationItem, parent: MainHelpSection) {
    this.deleteAbbreviation.emit({ abbreviation, parent });
  }

  public onDeleteSection(section: HelpTextSection | HelpTextStep) {
    this.deleteSection.emit(section);
  }

  public onMove(parent: ParentType, container: string, index: number, direction: 'up' | 'down') {
    this.moveSection.emit({ parent, container, index, direction });
  }

  public onMoveClick(event: MouseEvent, parent: ParentType, container: string, index: number, direction: 'up' | 'down') {
    event.preventDefault();
    event.stopPropagation();
    this.onMove(parent, container, index, direction);
  }

  onDrop(event: CdkDragDrop<DropContainerContext>) {
    const containerData = event.container.data;
    const previousContainerData = event.previousContainer.data as DropContainerContext | undefined;
    const dragContext = event.item.data as { parent: ParentType; container: string; index: number } | undefined;

    const fromParent = dragContext?.parent || previousContainerData?.parent;
    const fromContainer = dragContext?.container || previousContainerData?.container;
    const fromIndex = typeof event.previousIndex === 'number' ? event.previousIndex : dragContext?.index;

    if (!containerData || !fromParent || !fromContainer || fromIndex === undefined) { return; }

    const targetParent = containerData.parent;
    const targetContainer = containerData.container || fromContainer;
    const isChildDrop = containerData.mode === 'child';
    const targetCollection = this.getCollection(targetParent, targetContainer);

    const targetIndex = isChildDrop
      ? (targetCollection ? targetCollection.length : 0)
      : event.currentIndex;

    this.moveSection.emit({
      parent: targetParent,
      container: targetContainer,
      index: fromIndex,
      newIndex: targetIndex,
      fromParent,
      fromContainer
    });

    this.activeDropListId = null;
  }

  onDragStarted(event: CdkDragStart) {
    this.activeDropListId = null;
  }

  onDragEnded() {
    this.activeDropListId = null;
  }

  openContextMenu(event: MouseEvent, section: TreeItem, parent: ParentType, container: string, index: number) {
    event.preventDefault();
    event.stopPropagation();

    this.contextMenuContext = { section, parent, container, index };
    this.contextMenuItems = this.buildContextMenuItems(section, parent, container, index);

    if (this.contextMenu) {
      this.contextMenu.openContextMenu(event.clientX, event.clientY, this.contextMenuItems);
    }
  }

  private buildContextMenuItems(section: TreeItem, parent: ParentType, container: string, index: number): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];
    const hasContainer = !!container && !!parent && !!(parent as any)[container];
    const collection = hasContainer ? (parent as any)[container] as any[] : [];

    if (container === 'abbreviations') {
      items.push({ label: 'Add abbreviation', action: 'addAbbreviation' });
      items.push({ label: 'Edit abbreviation', action: 'editAbbreviation', disabled: !section });
      items.push({ label: 'Delete abbreviation', action: 'deleteAbbreviation', disabled: !section });
      return items;
    }

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
      case 'addAbbreviation':
        if (this.isMainHelpSection(parent)) { this.onAddAbbreviation(parent); }
        break;
      case 'editAbbreviation':
        if (this.isAbbreviation(section) && this.isMainHelpSection(parent)) { this.onEditAbbreviation(section, parent, index); }
        break;
      case 'deleteAbbreviation':
        if (this.isAbbreviation(section) && this.isMainHelpSection(parent)) { this.onDeleteAbbreviation(section, parent); }
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
        if (this.isHelpTextSection(section) || this.isHelpTextStep(section)) {
          this.onDeleteSection(section);
        }
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

  hasChildren(section: HelpTextSection | HelpTextStep) {
    if (section instanceof HelpTextSection) {
      return (section as HelpTextSection).hasChildren();
    }

    if (section instanceof HelpTextStep) {
      return !!section.substeps && section.substeps.length > 0;
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
        return !!this.expandedSections.find(x => x === section.value);
      } else 
      {
        return !!this.expandedSections.find(x => x === section.value)
      }
    }
    return false;
  }

  getTreeIcon(section: HelpTextSection | HelpTextStep): string {
    return this.getItemExpanded(section) ? 'expand_more' : 'chevron_right';
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

  isHelpTextSection(item: TreeItem): item is HelpTextSection {
    return !!item && (item instanceof HelpTextSection || (item as any).type && (item as any).type !== 'STEP');
  }

  isHelpTextStep(item: TreeItem): item is HelpTextStep {
    return !!item && (item as any).type === 'STEP';
  }

  isAbbreviation(item: TreeItem): item is AbbreviationItem {
    return !!item && (item as AbbreviationItem).abbreviation !== undefined && (item as any).type === undefined;
  }

  isMainHelpSection(item: ParentType): item is MainHelpSection {
    return !!item &&
      ((item instanceof MainHelpSection) ||
        ((item as any).abbreviations !== undefined && (item as any).value === undefined));
  }

  onDropListEntered(event: CdkDragEnter<DropContainerContext>) {
    this.activeDropListId = this.getDropListId(event.container.data);
  }

  onDropListExited(event: CdkDragExit<DropContainerContext>) {
    const id = this.getDropListId(event.container.data);
    if (id && this.activeDropListId === id) {
      this.activeDropListId = null;
    }
  }

  isChildDropActive(section: TreeItem, container: string): boolean {
    const context: DropContainerContext = { parent: section as ParentType, container, mode: 'child' };
    return this.activeDropListId === this.getDropListId(context);
  }

  canMoveUp(parent: ParentType, container: string, index: number): boolean {
    const collection = this.getCollection(parent, container);
    return !!collection && index > 0;
  }

  canMoveDown(parent: ParentType, container: string, index: number): boolean {
    const collection = this.getCollection(parent, container);
    return !!collection && index < collection.length - 1;
  }

  getDefaultChildContainer(section: TreeItem): string | null {
    if (!section) { return null; }
    if (this.isHelpTextStep(section)) {
      return 'substeps';
    }
    if (this.isHelpTextSection(section)) {
      if (this.showStepControls(section)) { return 'steps'; }
      if ((section as any).subsections !== undefined) { return 'subsections'; }
      if ((section as any).content !== undefined) { return 'content'; }
      if ((section as any).steps !== undefined) { return 'steps'; }
      if ((section as any).coversheet !== undefined) { return 'coversheet'; }
      return 'subsections';
    }
    return null;
  }

  private getCollection(parent: ParentType, container: string): any[] | null {
    if (!parent || !container || !(parent as any)[container]) {
      return null;
    }
    return (parent as any)[container] as any[];
  }

  private getDropListId(context?: DropContainerContext | null): string | null {
    if (!context) {
      return null;
    }
    const parentId = (context.parent as any)?.value || (context.parent as any)?.type || 'root';
    return `${parentId}-${context.container}-${context.mode || 'list'}`;
  }

  private expandToSelectedSection(selectedId: string) {
    const path = this.findPathToSection(this.helpItem, selectedId);
    if (!path || path.length === 0) {
      return;
    }

    const parents = path.slice(0, -1);
    parents.forEach(id => {
      if (id && !this.expandedSections.includes(id)) {
        this.expandedSections.push(id);
      }
    });
  }

  private findPathToSection(node: any, targetId: string): string[] | null {
    if (!node) {
      return null;
    }

    const nodeId = node.value;
    if (nodeId === targetId) {
      return [nodeId];
    }

    const containers = ['coversheet', 'content', 'subsections', 'steps', 'substeps'];
    for (const container of containers) {
      const items = node[container] as any[];
      if (!items || items.length === 0) {
        continue;
      }

      for (const child of items) {
        const childPath = this.findPathToSection(child, targetId);
        if (childPath) {
          return nodeId ? [nodeId, ...childPath] : childPath;
        }
      }
    }

    return null;
  }
}

import {
  CdkDrag,
  CdkDragDrop,
  CdkDragEnter,
  CdkDragExit,
  CdkDragMove,
  CdkDragStart,
  CdkDropList
} from '@angular/cdk/drag-drop';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren
} from '@angular/core';
import {
  MainHelpSection,
  HelpTextSection,
  HelpContentType,
  HelpTextStep,
  AbbreviationItem
} from '~models/help-text-structure.model';
import { ContextMenuComponent, ContextMenuItem } from '../context-menu/app-context-menu.component';

type ParentType = HelpTextSection | MainHelpSection | HelpTextStep;
type TreeItem = HelpTextSection | HelpTextStep | AbbreviationItem | null;
interface MoveEvent {
  parent: ParentType;
  container: string;
  index: number;
  direction?: 'up' | 'down';
  newIndex?: number;
  fromParent?: ParentType;
  fromContainer?: string;
}
interface DropContainerContext {
  parent: ParentType;
  container: string;
  mode?: 'list' | 'child';
}

@Component({
  selector: 'app-help-structure-treeview',
  templateUrl: './help-structure-treeview.component.html',
  styleUrls: ['./help-structure-treeview.component.scss'],
})
export class HelpStructureTreeviewComponent implements OnChanges, AfterViewInit {
  @Input() helpItem: MainHelpSection;
  @Input() topLevelKey: string;
  @Input() selectedHelpSection: HelpTextSection;
  @Output() itemClicked: EventEmitter<any> = new EventEmitter();
  @Output() addSubsection: EventEmitter<HelpTextSection> = new EventEmitter();
  @Output() addContent: EventEmitter<HelpTextSection | MainHelpSection> = new EventEmitter();
  @Output() addStep: EventEmitter<HelpTextSection> = new EventEmitter();
  @Output() deleteSection: EventEmitter<HelpTextSection | HelpTextStep> = new EventEmitter();
  @Output() moveSection: EventEmitter<MoveEvent> = new EventEmitter();
  @Output() addAbbreviation: EventEmitter<MainHelpSection> = new EventEmitter();
  @Output() editAbbreviation: EventEmitter<{
    abbreviation: AbbreviationItem;
    parent: MainHelpSection;
    index: number;
  }> = new EventEmitter();
  @Output() deleteAbbreviation: EventEmitter<{
    abbreviation: AbbreviationItem;
    parent: MainHelpSection;
  }> = new EventEmitter();

  @ViewChild('contextMenu') contextMenu: ContextMenuComponent;
  @ViewChild('treeRoot') treeRootRef: ElementRef<HTMLElement>;
  @ViewChildren(CdkDropList) dropLists: QueryList<CdkDropList<DropContainerContext>>;

  contextMenuItems: ContextMenuItem[] = [];
  private contextMenuContext: {
    section: TreeItem;
    parent: ParentType;
    container: string;
    index: number;
  } | null = null;

  private expandedSections: string[];
  private activeDropListId: string | null = null;
  private dragCancelled = false;
  private parentIdMap = new WeakMap<object, number>();
  private parentIdCounter = 0;
  connectedDropListIds: string[] = [];

  listEnterPredicate = (drag: CdkDrag, drop: CdkDropList<DropContainerContext>) => this.canEnterDropList(drag, drop, 'list');
  childEnterPredicate = (drag: CdkDrag, drop: CdkDropList<DropContainerContext>) => this.canEnterDropList(drag, drop, 'child');

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

  ngAfterViewInit(): void {
    this.refreshConnectedDropLists();
    this.dropLists?.changes.subscribe(() => this.refreshConnectedDropLists());
  }

  getSelectedItem(): MainHelpSection {
    return this.helpItem;
  }

  public onSelectTreeItem(event) {
    if (this.itemClicked) {
      // console.log("click ", event);
      this.itemClicked.emit(event);
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
    if (this.dragCancelled) {
      this.activeDropListId = null;
      return;
    }

    const containerData = event.container.data;
    const previousContainerData = event.previousContainer.data as DropContainerContext | undefined;
    const dragContext = event.item.data as { parent: ParentType; container: string; index: number } | undefined;

    const fromParent = dragContext?.parent || previousContainerData?.parent;
    const fromContainer = dragContext?.container || previousContainerData?.container;
    const fromIndex = dragContext?.index ?? event.previousIndex;

    if (!containerData || !fromParent || !fromContainer || fromIndex === undefined) { return; }
    if (containerData.mode === 'child' && !this.canAcceptChildDrop(containerData.parent, containerData.container)) { return; }

    const targetParent = containerData.parent;
    const targetContainer = containerData.container || fromContainer;
    const draggedItem = this.getDraggedItem(dragContext);
    if (draggedItem && this.isTargetInDraggedBranch(targetParent, draggedItem)) { return; }
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
    this.dragCancelled = false;
  }

  onDragEnded() {
    this.activeDropListId = null;
    this.dragCancelled = false;
  }

  onDragMoved(event: CdkDragMove) {
    if (!this.treeRootRef?.nativeElement || this.dragCancelled) {
      return;
    }
    const { x, y } = event.pointerPosition;
    const rect = this.treeRootRef.nativeElement.getBoundingClientRect();
    const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    if (!inside) {
      this.cancelDrag(event.source);
    }
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
    const calc_margin = (level - 1) * 20;

    const styles = {
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
      // console.log("closing ", section);
      this.expandedSections = this.expandedSections.filter(item => item !== section);
    } else {
      // console.log("expanding ", section);
      this.expandedSections.push(section);
    }

  }

  getItemExpanded(section) {
    if (section) {
      // console.log("expanded? ", section.value);
      if (section.value) {
        return !!this.expandedSections.find(x => x === section.value);
      } else {
        return !!this.expandedSections.find(x => x === section.value);
      }
    }
    return false;
  }

  getTreeIcon(section: HelpTextSection | HelpTextStep): string {
    return this.getItemExpanded(section) ? 'expand_more' : 'chevron_right';
  }

  isSelectedSection(section) {
    if (this.selectedHelpSection && section) {
      // console.log("isSelected", this.selectedHelpSection.value);
      return this.selectedHelpSection.value === section.value;
    } else { return false; }
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
    if (this.dragCancelled) { return; }
    const dropId = this.getDropListId(event.container.data);
    const mode = event.container.data?.mode || 'list';
    this.activeDropListId = this.canEnterDropList(event.item, event.container, mode) ? dropId : null;
  }

  onDropListExited(event: CdkDragExit<DropContainerContext>) {
    if (this.dragCancelled) { return; }
    const id = this.getDropListId(event.container.data);
    if (id && this.activeDropListId === id) {
      this.activeDropListId = null;
    }
  }

  isChildDropActive(section: TreeItem, container: string): boolean {
    const context: DropContainerContext = { parent: section as ParentType, container, mode: 'child' };
    return this.activeDropListId === this.getDropListId(context);
  }

  canAcceptChildDrop(section: ParentType, container: string): boolean {
    return !!container && this.getDefaultChildContainer(section as unknown as TreeItem) === container
      && Object.prototype.hasOwnProperty.call(section as any, container);
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
    if (!parent || !container || !Object.prototype.hasOwnProperty.call(parent as any, container)) {
      return null;
    }
    const value = (parent as any)[container];
    return Array.isArray(value) ? value as any[] : null;
  }

  private getDropListId(context?: DropContainerContext | null): string | null {
    if (!context) {
      return null;
    }
    const parentId = this.getParentKey(context.parent);
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

  private refreshConnectedDropLists() {
    const lists = this.dropLists ? this.dropLists.toArray() : [];
    this.connectedDropListIds = lists
      .map(list => list.id)
      .filter(id => !!id);
  }

  getConnectedDropListIds(currentId: string | null): string[] {
    return this.connectedDropListIds.filter(id => id && id !== currentId);
  }

  private cancelDrag(source: CdkDrag) {
    this.dragCancelled = true;
    this.activeDropListId = null;
    (source as any)?._dragRef?.reset();
  }

  private canEnterDropList(drag: CdkDrag, drop: CdkDropList<DropContainerContext>, mode: 'list' | 'child'): boolean {
    if (this.dragCancelled) { return false; }
    const dropData = drop.data;
    if (!dropData || !dropData.parent || !dropData.container) { return false; }
    if ((dropData.mode || 'list') !== mode) { return false; }
    const dragContext = drag.data as { parent: ParentType; container: string; index: number } | undefined;
    const draggedItem = this.getDraggedItem(dragContext);
    if (!dragContext || !draggedItem) { return false; }

    if (mode === 'child' && !this.canAcceptChildDrop(dropData.parent, dropData.container)) {
      return false;
    }

    const targetParent = dropData.parent;
    if (this.isTargetInDraggedBranch(targetParent, draggedItem)) {
      return false;
    }

    if (mode === 'list') {
      const targetCollection = this.getCollection(targetParent, dropData.container);
      return !!targetCollection;
    }

    return true;
  }

  private getDraggedItem(dragContext?: { parent: ParentType; container: string; index: number }) {
    if (!dragContext || dragContext.parent === undefined || dragContext.container === undefined || dragContext.index === undefined) {
      return null;
    }
    const collection = this.getCollection(dragContext.parent, dragContext.container);
    if (!collection) {
      return null;
    }
    return collection[dragContext.index] as TreeItem;
  }

  private isTargetInDraggedBranch(targetParent: ParentType, draggedItem: TreeItem): boolean {
    if (!targetParent || !draggedItem) { return false; }
    if (targetParent === draggedItem) { return true; }
    return this.isDescendant(targetParent, draggedItem);
  }

  private isDescendant(target: ParentType, potentialAncestor: TreeItem): boolean {
    const children = this.getChildren(potentialAncestor);
    for (const child of children) {
      if (child === target) {
        return true;
      }
      if (this.isDescendant(target, child)) {
        return true;
      }
    }
    return false;
  }

  private getChildren(item: TreeItem): TreeItem[] {
    if (!item) { return []; }
    if (this.isHelpTextStep(item)) {
      return (item.substeps || []) as TreeItem[];
    }
    if (this.isHelpTextSection(item)) {
      return [
        ...(item.coversheet || []),
        ...(item.content || []),
        ...(item.subsections || []),
        ...(item.steps || []),
      ] as TreeItem[];
    }
    return [];
  }

  private getParentKey(parent: ParentType): string {
    if (!parent) { return 'root'; }
    if (!this.parentIdMap.has(parent as unknown as object)) {
      this.parentIdCounter += 1;
      this.parentIdMap.set(parent as unknown as object, this.parentIdCounter);
    }
    const base = (parent as any)?.value || (parent as any)?.type || 'root';
    return `${base}-${this.parentIdMap.get(parent as unknown as object)}`;
  }
}

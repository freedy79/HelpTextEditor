import {
  CdkDrag,
  CdkDragDrop,
  CdkDragEnter,
  CdkDragExit,
  CdkDragEnd,
  CdkDragMove,
  CdkDragStart,
  CdkDropList,
  Point,
  moveItemInArray,
  transferArrayItem
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
import { MainHelpSection, HelpTextSection, HelpContentType, HelpTextStep, AbbreviationItem } from '~models/help-text-structure.model';
import { ContextMenuComponent, ContextMenuItem } from '../context-menu/app-context-menu.component';

type ParentType = HelpTextSection | MainHelpSection | HelpTextStep;
type TreeItem = HelpTextSection | HelpTextStep | AbbreviationItem | null;
type DragContext = { item?: TreeItem; parent: ParentType; container: string; index: number };
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
interface DropIndicatorState {
  parent: ParentType;
  container: string;
  index: number;
  position: 'above' | 'below';
}
interface RowContext extends DropContainerContext {
  element: HTMLElement;
  item: TreeItem;
  index: number;
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
  @ViewChildren('treeRowEl', { read: ElementRef }) treeRows: QueryList<ElementRef<HTMLElement>>;

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
  private currentDragContext: DragContext | null = null;
  private dragStartContext: DragContext | null = null;
  private parentIdMap = new WeakMap<object, number>();
  private parentIdCounter = 0;
  private dropListRefreshScheduled = false;
  private previewRoot: MainHelpSection | null = null;
  private previewMap: WeakMap<object, Record<string, any[]>> = new WeakMap();
  private dropIndicator: DropIndicatorState | null = null;
  private hoverExpandTimer: any = null;
  private hoverExpandTargetId: string | null = null;
  private parentLookup: Map<string, ParentType> = new Map();
  private itemLookup: Map<string, TreeItem> = new Map();
  private itemKeyMap: WeakMap<object, string> = new WeakMap();
  private itemKeyCounter = 0;
  connectedDropListIds: string[] = [];
  debugLogging = true;

  /*
   * Diagnose (Root Causes):
   * - Template context mixed $implicit and let-parent without explicit aliasing; parent/drag context
   *   pointed at the dragged item instead of its parent and broke fromParent/fromContainer resolution.
   * - onDrop only emitted moveSection without mutating the local array, so the UI never re-ordered
   *   unless the parent re-supplied inputs.
   * - Drag data omitted the item, so sourceId detection and branch validation could fail.
   * Fixes:
   * - Explicit template context aliases for section/parent/container/index/level.
 * - Added drop logging and immediate local move (moveItemInArray/transferArrayItem) before emitting
 *   moveSection.
 * - cdkDragData now includes the dragged item for stable IDs and validation.
 *
 * Additional diagnoses:
 * - Previously no cdkDragEnded handler was attached, so drops outside of a cdkDropList never
 *   produced a completion signal; we now always listen to onDragEnded and clean up preview state.
 * - Sorting did not visually snap because we rendered the live model while dragging; a preview
 *   view-model now reorders in memory, paired with a blue-line indicator for the hovered row.
 */

  listEnterPredicate = (drag: CdkDrag, drop: CdkDropList<DropContainerContext>) => this.canEnterDropList(drag, drop, 'list');
  childEnterPredicate = (drag: CdkDrag, drop: CdkDropList<DropContainerContext>) => this.canEnterDropList(drag, drop, 'child');
  constrainY = (point: Point) => ({ x: 0, y: point.y });

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
    this.scheduleRefreshConnectedDropLists();
    this.dropLists?.changes.subscribe(() => this.scheduleRefreshConnectedDropLists());
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
    if (this.debugLogging) {
      console.log('[Treeview:onDrop]', {
        previousContainerId: event.previousContainer?.id,
        containerId: event.container?.id,
        previousIndex: event.previousIndex,
        currentIndex: event.currentIndex,
        dragData: event.item.data,
        containerData: event.container.data,
      });
      const rect = event.container.element.nativeElement.getBoundingClientRect();
      console.log('[Treeview:onDrop:containerRect]', rect);
    }
    if (this.dragCancelled) {
      this.activeDropListId = null;
      return;
    }

    const containerData = event.container.data;
    if (!containerData) {
      this.activeDropListId = null;
      console.warn('[Treeview:onDrop] Missing container data, aborting drop.');
      return;
    }
    const previousContainerData = event.previousContainer.data as DropContainerContext | undefined;
    const dragContext = (event.item.data as DragContext | undefined) || this.currentDragContext;

    const fromParent = this.dragStartContext?.parent || dragContext?.parent || previousContainerData?.parent;
    const fromContainer = this.dragStartContext?.container || dragContext?.container || previousContainerData?.container;
    const fromIndex = this.dragStartContext?.index ?? dragContext?.index ?? event.previousIndex;
    if (this.debugLogging) {
      console.log('[Treeview:onDrop:context]', {
        fromParent,
        fromContainer,
        fromIndex,
        dragContext,
        previousContainerData,
      });
    }

    if (!containerData || !fromParent || !fromContainer || fromIndex === undefined) {
      console.warn('[Treeview:onDrop] Missing drop or drag context', { containerData, fromParent, fromContainer, fromIndex });
      return;
    }
    if (containerData.mode === 'child' && !this.canAcceptChildDrop(containerData.parent, containerData.container)) {
      console.warn('[Treeview:onDrop] Child drop rejected by predicate');
      return;
    }

    const targetParent = containerData.parent;
    const targetContainer = containerData.container || fromContainer;
    const draggedItem = this.getDraggedItem(dragContext);
    if (draggedItem && this.isTargetInDraggedBranch(targetParent, draggedItem)) {
      console.warn('[Treeview:onDrop] Target in dragged branch, cancelling');
      return;
    }
    const isChildDrop = containerData.mode === 'child';
    const targetCollection = this.getCollection(targetParent, targetContainer);
    if (!targetCollection) {
      console.warn('[Treeview:onDrop] No target collection found, aborting drop.');
      this.activeDropListId = null;
      return;
    }

    let targetIndex = isChildDrop ? targetCollection.length : event.currentIndex;
    if (this.dropIndicator && this.dropIndicator.parent === targetParent && this.dropIndicator.container === targetContainer) {
      targetIndex = this.dropIndicator.position === 'below' ? this.dropIndicator.index + 1 : this.dropIndicator.index;
    }
    if (this.debugLogging) {
      console.log('[Treeview:onDrop:target]', {
        targetParent,
        targetContainer,
        targetIndex,
        isChildDrop,
        targetCollectionLength: targetCollection?.length,
        dropIndicator: this.dropIndicator
      });
    }

    const sourceCollection = this.getCollection(fromParent, fromContainer);
    if (!sourceCollection) {
      console.warn('[Treeview:onDrop] No source collection found, aborting drop.');
      this.activeDropListId = null;
      return;
    }

    if (sourceCollection === targetCollection) {
      moveItemInArray(sourceCollection, fromIndex, targetIndex);
    } else {
      transferArrayItem(sourceCollection, targetCollection, fromIndex, targetIndex);
    }

    this.moveSection.emit({
      parent: targetParent,
      container: targetContainer,
      index: fromIndex,
      newIndex: targetIndex,
      fromParent,
      fromContainer
    });

    this.dragStartContext = null;
    this.activeDropListId = null;
    this.resetPreview();
  }

  onDragStarted(event: CdkDragStart) {
    this.activeDropListId = null;
    this.dragCancelled = false;
    this.currentDragContext = event.source?.data as DragContext || null;
    this.dragStartContext = this.currentDragContext ? { ...this.currentDragContext } : null;
    const item = this.currentDragContext?.item;
    const sourceId = this.getItemId(item);
    this.previewRoot = this.helpItem;
    this.dropIndicator = null;
    this.hoverExpandTargetId = null;
    this.clearHoverExpandTimer();
    if (this.debugLogging) {
      console.log('[Treeview:onDragStarted]', {
        dragData: this.currentDragContext,
        sourceId,
        sourceElementRect: event.source.element.nativeElement.getBoundingClientRect()
      });
    }
  }

  onDragEnded(event: CdkDragEnd) {
    this.activeDropListId = null;
    this.dragCancelled = false;
    this.currentDragContext = null;
    this.dragStartContext = null;
    this.clearHoverExpandTimer();
    const distance = event.distance;
    const pointerPosition = (event.source as any)?._dragRef?.getFreeDragPosition?.();
    if (this.debugLogging) {
      console.log('[Treeview:onDragEnded]', {
        distance,
        pointerPosition,
        dropIndicator: this.dropIndicator
      });
    }
    this.resetPreview();
  }

  onDragMoved(event: CdkDragMove) {
    if (!this.treeRootRef?.nativeElement || this.dragCancelled) {
      return;
    }
    if (this.debugLogging && this.activeDropListId) {
      console.log('[Treeview:onDragMoved]', {
        activeDropListId: this.activeDropListId,
        dragCancelled: this.dragCancelled
      });
    }
    const { x, y } = event.pointerPosition;
    const rect = this.treeRootRef.nativeElement.getBoundingClientRect();
    const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    if (!inside) {
      this.cancelDrag(event.source);
      this.clearHoverExpandTimer();
      this.dropIndicator = null;
      return;
    }

    const targetContext = this.findRowContextAtY(y);
    this.handleHoverExpand(targetContext);
    this.updateDropIndicator(targetContext, y);
    this.updatePreviewPosition(targetContext);
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
    if (this.debugLogging) {
      const rect = event.container.element.nativeElement.getBoundingClientRect();
      console.log('[Treeview:onDropListEntered]', {
        dropId,
        mode,
        canEnter: this.activeDropListId === dropId,
        rect,
        dropData: event.container.data
      });
    }
  }

  onDropListExited(event: CdkDragExit<DropContainerContext>) {
    if (this.dragCancelled) { return; }
    const id = this.getDropListId(event.container.data);
    if (id && this.activeDropListId === id) {
      this.activeDropListId = null;
    }
    if (this.debugLogging) {
      console.log('[Treeview:onDropListExited]', {
        dropId: id,
        dropData: event.container.data
      });
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

  getDropListId(context?: DropContainerContext | null): string | null {
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

  private scheduleRefreshConnectedDropLists() {
    if (this.dropListRefreshScheduled) {
      return;
    }

    this.dropListRefreshScheduled = true;
    Promise.resolve().then(() => {
      this.dropListRefreshScheduled = false;
      this.refreshConnectedDropLists();
    });
  }

  getConnectedDropListIds(currentId: string | null): string[] {
    return this.connectedDropListIds.filter(id => id && id !== currentId);
  }

  private cancelDrag(source: CdkDrag) {
    this.dragCancelled = true;
    this.activeDropListId = null;
    this.currentDragContext = null;
    this.dragStartContext = null;
    this.resetPreview();
    (source as any)?._dragRef?.reset();
  }

  private canEnterDropList(drag: CdkDrag, drop: CdkDropList<DropContainerContext>, mode: 'list' | 'child'): boolean {
    if (this.dragCancelled) { return false; }
    const dropData = drop.data;
    if (!dropData || !dropData.parent || !dropData.container) { return false; }
    if ((dropData.mode || 'list') !== mode) { return false; }
    const dragContext = drag.data as DragContext | undefined;
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

  private canPreviewEnterList(targetParent: ParentType, targetContainer: string): boolean {
    if (this.dragCancelled || !this.currentDragContext) { return false; }
    if (!targetParent || !targetContainer) { return false; }
    const draggedItem = this.getDraggedItem(this.currentDragContext);
    if (!draggedItem) { return false; }
    if (this.isTargetInDraggedBranch(targetParent, draggedItem)) { return false; }
    const targetCollection = this.getCollection(targetParent, targetContainer);
    return !!targetCollection;
  }

  private getDraggedItem(dragContext?: DragContext) {
    if (!dragContext || dragContext.parent === undefined || dragContext.container === undefined || dragContext.index === undefined) {
      return null;
    }
    if (dragContext.item) {
      return dragContext.item;
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

  getParentKey(parent: ParentType): string {
    if (!parent) { return 'root'; }
    if (!this.parentIdMap.has(parent as unknown as object)) {
      this.parentIdCounter += 1;
      this.parentIdMap.set(parent as unknown as object, this.parentIdCounter);
    }
    const base = (parent as any)?.value || (parent as any)?.type || 'root';
    const key = `${base}-${this.parentIdMap.get(parent as unknown as object)}`;
    this.parentLookup.set(key, parent);
    return key;
  }

  private getItemId(item: TreeItem | null | undefined): string | null {
    if (!item) { return null; }
    if (this.isHelpTextSection(item) || this.isHelpTextStep(item)) {
      return item.value || null;
    }
    if (this.isAbbreviation(item)) {
      return item.abbreviation || null;
    }
    if ('id' in (item as Record<string, unknown>) && typeof (item as Record<string, unknown>).id === 'string') {
      return (item as { id: string }).id;
    }
    if ('key' in (item as Record<string, unknown>) && typeof (item as Record<string, unknown>).key === 'string') {
      return (item as { key: string }).key;
    }
    if ('titleKey' in (item as Record<string, unknown>) && typeof (item as Record<string, unknown>).titleKey === 'string') {
      return (item as { titleKey: string }).titleKey;
    }
    if ('value' in (item as Record<string, unknown>) && typeof (item as Record<string, unknown>).value === 'string') {
      return (item as { value: string }).value;
    }
    return null;
  }

  getItemKey(item: TreeItem | null | undefined): string {
    if (!item) { return 'null-item'; }
    if (!this.itemKeyMap.has(item as unknown as object)) {
      this.itemKeyCounter += 1;
      this.itemKeyMap.set(item as unknown as object, `item-${this.itemKeyCounter}`);
    }
    const key = this.itemKeyMap.get(item as unknown as object)!;
    this.itemLookup.set(key, item);
    return key;
  }

  trackByItem = (_: number, item: TreeItem) => this.getItemKey(item);

  getViewCollection(parent: ParentType, container: string): any[] {
    const preview = this.getPreviewCollection(parent, container);
    if (preview) { return preview; }
    const original = this.getCollection(parent, container);
    return original || [];
  }

  private getPreviewCollection(parent: ParentType, container: string): any[] | null {
    const map = parent ? this.previewMap.get(parent as unknown as object) : null;
    if (map && map[container]) {
      return map[container];
    }
    return null;
  }

  private ensurePreviewCollection(parent: ParentType, container: string): any[] | null {
    const original = this.getCollection(parent, container);
    if (!original) { return null; }
    let map = this.previewMap.get(parent as unknown as object);
    if (!map) {
      map = {};
      this.previewMap.set(parent as unknown as object, map);
    }
    if (!map[container]) {
      map[container] = [...original];
    }
    return map[container];
  }

  private resetPreview() {
    this.previewRoot = null;
    this.previewMap = new WeakMap();
    this.dropIndicator = null;
    this.hoverExpandTargetId = null;
    this.clearHoverExpandTimer();
  }

  private findRowContextAtY(y: number): RowContext | null {
    const rows = this.treeRows?.toArray() || [];
    for (const rowRef of rows) {
      const el = rowRef.nativeElement;
      const rect = el.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom) {
        const parentKey = el.dataset['parentKey'];
        const container = el.dataset['container'];
        const index = parseInt(el.dataset['index'] || '-1', 10);
        const itemKey = el.dataset['itemKey'];
        const parent = parentKey ? this.parentLookup.get(parentKey) : null;
        const item = itemKey ? this.itemLookup.get(itemKey) : null;
        if (!parent || !container || !item || Number.isNaN(index)) {
          continue;
        }
        return {
          parent,
          container,
          mode: 'list',
          element: el,
          item,
          index
        };
      }
    }
    return null;
  }

  private updateDropIndicator(targetContext: RowContext | null, pointerY: number) {
    if (!targetContext) {
      this.dropIndicator = null;
      return;
    }
    const rect = targetContext.element.getBoundingClientRect();
    const position = pointerY < rect.top + rect.height / 2 ? 'above' : 'below';
    this.dropIndicator = {
      parent: targetContext.parent,
      container: targetContext.container,
      index: targetContext.index,
      position
    };
  }

  private updatePreviewPosition(targetContext: RowContext | null) {
    if (!this.currentDragContext || !this.previewRoot || !targetContext) {
      return;
    }
    const draggedItem = this.getDraggedItem(this.currentDragContext);
    if (!draggedItem) { return; }
    if (!this.canPreviewEnterList(targetContext.parent, targetContext.container)) {
      return;
    }
    const { parent: sourceParent, container: sourceContainer } = this.currentDragContext;
    const sourceCollection = this.ensurePreviewCollection(sourceParent, sourceContainer);
    const targetCollection = this.ensurePreviewCollection(targetContext.parent, targetContext.container);
    if (!sourceCollection || !targetCollection) { return; }
    const sourceIndex = sourceCollection.indexOf(draggedItem);
    if (sourceIndex === -1) { return; }

    const targetIndex = this.dropIndicator
      ? (this.dropIndicator.position === 'below' ? this.dropIndicator.index + 1 : this.dropIndicator.index)
      : targetContext.index;

    if (targetCollection === sourceCollection && targetIndex === sourceIndex) {
      return;
    }
    if (targetCollection === sourceCollection) {
      moveItemInArray(targetCollection, sourceIndex, targetIndex);
    } else {
      transferArrayItem(sourceCollection, targetCollection, sourceIndex, targetIndex);
      this.currentDragContext = {
        ...this.currentDragContext,
        parent: targetContext.parent,
        container: targetContext.container,
        index: targetIndex
      };
    }
  }

  private handleHoverExpand(targetContext: RowContext | null) {
    if (!targetContext || !targetContext.item) {
      this.clearHoverExpandTimer();
      return;
    }
    const itemId = this.getItemId(targetContext.item);
    const isCollapsible = this.hasChildren(targetContext.item as any) && !this.getItemExpanded(targetContext.item as any);
    if (!isCollapsible || !itemId) {
      this.clearHoverExpandTimer();
      return;
    }
    if (this.hoverExpandTargetId !== itemId) {
      this.clearHoverExpandTimer();
      this.hoverExpandTargetId = itemId;
      this.hoverExpandTimer = setTimeout(() => {
        this.onOpenCloseSection(itemId);
      }, 750);
    }
  }

  private clearHoverExpandTimer() {
    if (this.hoverExpandTimer) {
      clearTimeout(this.hoverExpandTimer);
      this.hoverExpandTimer = null;
    }
    this.hoverExpandTargetId = null;
  }

  isDropAbove(section: TreeItem, parent: ParentType, container: string, index: number): boolean {
    return !!this.dropIndicator &&
      this.dropIndicator.parent === parent &&
      this.dropIndicator.container === container &&
      this.dropIndicator.index === index &&
      this.dropIndicator.position === 'above';
  }

  isDropBelow(section: TreeItem, parent: ParentType, container: string, index: number): boolean {
    return !!this.dropIndicator &&
      this.dropIndicator.parent === parent &&
      this.dropIndicator.container === container &&
      this.dropIndicator.index === index &&
      this.dropIndicator.position === 'below';
  }
}

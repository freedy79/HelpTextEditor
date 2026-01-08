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
import { ElementRef, Injectable, QueryList } from '@angular/core';
import {
  MainHelpSection,
  HelpTextSection,
  HelpTextStep,
  AbbreviationItem,
  isEnumerationContentType,
  isNonNestableType,
  getSectionSelectionId,
  isStepNode
} from '~models/help-text-structure.model';

type ParentType = HelpTextSection | MainHelpSection | HelpTextStep;
export type TreeItem = HelpTextSection | HelpTextStep | MainHelpSection | AbbreviationItem | null;
export type DragContext = { item?: TreeItem; parent: ParentType; container: string; index: number };
export interface MoveEvent {
  parent: ParentType;
  container: string;
  index: number;
  direction?: 'up' | 'down';
  newIndex?: number;
  fromParent?: ParentType;
  fromContainer?: string;
}
export interface DropContainerContext {
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

@Injectable()
export class TreeDragDropService {
  listEnterPredicate = (drag: CdkDrag, drop: CdkDropList<DropContainerContext>) =>
    this.canEnterDropList(drag, drop, 'list');
  childEnterPredicate = (drag: CdkDrag, drop: CdkDropList<DropContainerContext>) =>
    this.canEnterDropList(drag, drop, 'child');
  constrainY = (point: Point) => ({ x: 0, y: point.y });

  connectedDropListIds: string[] = [];
  debugLogging = true;

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
  private dropLists: QueryList<CdkDropList<DropContainerContext>> | null = null;
  private treeRootRef: ElementRef<HTMLElement> | null = null;
  private treeRows: QueryList<ElementRef<HTMLElement>> | null = null;

  private hoverCallbacks: {
    openCloseSection: (id: string) => void;
    getItemExpanded: (item: TreeItem) => boolean;
    hasChildren: (item: TreeItem) => boolean;
  } | null = null;

  registerDropLists(dropLists: QueryList<CdkDropList<DropContainerContext>>) {
    this.dropLists = dropLists;
    this.scheduleRefreshConnectedDropLists();
    this.dropLists?.changes.subscribe(() => this.scheduleRefreshConnectedDropLists());
  }

  registerTreeRoot(treeRootRef: ElementRef<HTMLElement>) {
    this.treeRootRef = treeRootRef;
  }

  registerTreeRows(treeRows: QueryList<ElementRef<HTMLElement>>) {
    this.treeRows = treeRows;
  }

  configureHoverCallbacks(callbacks: {
    openCloseSection: (id: string) => void;
    getItemExpanded: (item: TreeItem) => boolean;
    hasChildren: (item: TreeItem) => boolean;
  }) {
    this.hoverCallbacks = callbacks;
  }

  setDropIndicatorForTest(dropIndicator: DropIndicatorState | null) {
    this.dropIndicator = dropIndicator;
  }

  onDrop(event: CdkDragDrop<DropContainerContext>): MoveEvent | null {
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
      return null;
    }

    const containerData = event.container.data;
    if (!containerData) {
      this.activeDropListId = null;
      console.warn('[Treeview:onDrop] Missing container data, aborting drop.');
      return null;
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
      return null;
    }
    if (this.isCoverContainer(containerData.container) || this.isCoverContainer(fromContainer)) {
      if (this.debugLogging) {
        console.log('[Treeview:onDrop] Cover container drop blocked', { containerData, fromContainer });
      }
      this.activeDropListId = null;
      this.resetPreview();
      return null;
    }
    if (containerData.mode === 'child' && !this.canAcceptChildDrop(containerData.parent, containerData.container)) {
      console.warn('[Treeview:onDrop] Child drop rejected by predicate');
      return null;
    }

    const targetParent = containerData.parent;
    const targetContainer = containerData.container || fromContainer;
    const draggedItem = this.getDraggedItem(dragContext);
    if (draggedItem && this.isTargetInDraggedBranch(targetParent, draggedItem)) {
      console.warn('[Treeview:onDrop] Target in dragged branch, cancelling');
      return null;
    }
    const isChildDrop = containerData.mode === 'child';
    const targetCollection = this.getCollection(targetParent, targetContainer);
    if (!targetCollection) {
      console.warn('[Treeview:onDrop] No target collection found, aborting drop.');
      this.activeDropListId = null;
      return null;
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
      return null;
    }

    if (sourceCollection === targetCollection) {
      moveItemInArray(sourceCollection, fromIndex, targetIndex);
    } else {
      transferArrayItem(sourceCollection, targetCollection, fromIndex, targetIndex);
    }

    const moveEvent: MoveEvent = {
      parent: targetParent,
      container: targetContainer,
      index: fromIndex,
      newIndex: targetIndex,
      fromParent,
      fromContainer
    };

    this.dragStartContext = null;
    this.activeDropListId = null;
    this.resetPreview();

    return moveEvent;
  }

  onDragStarted(event: CdkDragStart, helpItem: MainHelpSection) {
    this.activeDropListId = null;
    this.dragCancelled = false;
    this.currentDragContext = event.source?.data as DragContext || null;
    this.dragStartContext = this.currentDragContext ? { ...this.currentDragContext } : null;
    const item = this.currentDragContext?.item;
    const sourceId = this.getItemId(item);
    this.previewRoot = helpItem;
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
    if (this.isHelpTextSection(section) && isNonNestableType(section.type)) {
      return false;
    }
    return !!container && this.getDefaultChildContainer(section as unknown as TreeItem) === container
      && Object.prototype.hasOwnProperty.call(section as any, container);
  }

  canMoveUp(parent: ParentType, container: string, index: number): boolean {
    if (this.isCoverContainer(container)) {
      return false;
    }
    const collection = this.getCollection(parent, container);
    return !!collection && index > 0;
  }

  canMoveDown(parent: ParentType, container: string, index: number): boolean {
    if (this.isCoverContainer(container)) {
      return false;
    }
    const collection = this.getCollection(parent, container);
    return !!collection && index < collection.length - 1;
  }

  getDefaultChildContainer(section: TreeItem): string | null {
    if (!section) { return null; }
    if (this.isHelpTextStep(section)) {
      return 'substeps';
    }
    if (this.isHelpTextSection(section)) {
      if (isNonNestableType(section.type)) {
        return null;
      }
      if (this.showStepControls(section)) { return 'steps'; }
      if ((section as any).subsections !== undefined) { return 'subsections'; }
      if ((section as any).content !== undefined) { return 'content'; }
      if ((section as any).steps !== undefined) { return 'steps'; }
      if ((section as any).coversheet !== undefined) { return 'coversheet'; }
      return 'subsections';
    }
    return null;
  }

  getViewCollection(parent: ParentType, container: string): any[] {
    const preview = this.getPreviewCollection(parent, container);
    if (preview) { return preview; }
    const original = this.getCollection(parent, container);
    return original || [];
  }

  getDropListId(context?: DropContainerContext | null): string | null {
    if (!context) {
      return null;
    }
    const parentId = this.getParentKey(context.parent);
    return `${parentId}-${context.container}-${context.mode || 'list'}`;
  }

  getConnectedDropListIds(currentId: string | null): string[] {
    return this.connectedDropListIds.filter(id => id && id !== currentId);
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

  isDropAbove(parent: ParentType, container: string, index: number): boolean {
    return !!this.dropIndicator &&
      this.dropIndicator.parent === parent &&
      this.dropIndicator.container === container &&
      this.dropIndicator.index === index &&
      this.dropIndicator.position === 'above';
  }

  isDropBelow(parent: ParentType, container: string, index: number): boolean {
    return !!this.dropIndicator &&
      this.dropIndicator.parent === parent &&
      this.dropIndicator.container === container &&
      this.dropIndicator.index === index &&
      this.dropIndicator.position === 'below';
  }

  showStepControls(section: HelpTextSection): boolean {
    return !!section && isEnumerationContentType(section.type);
  }

  isHelpTextSection(item: ParentType | TreeItem): item is HelpTextSection {
    return !!item && (item instanceof HelpTextSection || ((item as any).type && !isStepNode(item as HelpTextStep)));
  }

  isHelpTextStep(item: TreeItem): item is HelpTextStep {
    return isStepNode(item as HelpTextStep);
  }

  isAbbreviation(item: TreeItem): item is AbbreviationItem {
    return !!item && (item as AbbreviationItem).abbreviation !== undefined && (item as any).type === undefined;
  }

  isMainHelpSection(item: ParentType): item is MainHelpSection {
    return !!item &&
      ((item instanceof MainHelpSection) ||
        ((item as any).abbreviations !== undefined && (item as any).value === undefined));
  }

  getItemSelectionId(item: TreeItem): string | null {
    if (!item) {
      return null;
    }
    if (this.isHelpTextStep(item)) {
      return item.value || null;
    }
    if (this.isHelpTextSection(item)) {
      return getSectionSelectionId(item);
    }
    if (this.isAbbreviation(item)) {
      return item.abbreviation || null;
    }
    return null;
  }

  canEnterDropListContext(
    dragContext: DragContext | null | undefined,
    dropData: DropContainerContext | null | undefined,
    mode: 'list' | 'child'
  ): boolean {
    if (this.dragCancelled) { return false; }
    if (!dropData || !dropData.parent || !dropData.container) { return false; }
    if ((dropData.mode || 'list') !== mode) { return false; }
    if (this.isCoverContainer(dropData.container)) { return false; }
    const draggedItem = this.getDraggedItem(dragContext || undefined);
    if (!dragContext || !draggedItem) { return false; }
    if (this.isCoverContainer(dragContext.container)) { return false; }

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

  private cancelDrag(source: CdkDrag) {
    this.dragCancelled = true;
    this.activeDropListId = null;
    this.currentDragContext = null;
    this.dragStartContext = null;
    this.resetPreview();
    (source as any)?._dragRef?.reset();
  }

  private canEnterDropList(drag: CdkDrag, drop: CdkDropList<DropContainerContext>, mode: 'list' | 'child'): boolean {
    return this.canEnterDropListContext(drag.data as DragContext | undefined, drop.data, mode);
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

  private getCollection(parent: ParentType, container: string): any[] | null {
    if (!parent || !container || !Object.prototype.hasOwnProperty.call(parent as any, container)) {
      return null;
    }
    const value = (parent as any)[container];
    return Array.isArray(value) ? value as any[] : null;
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
    if (!this.hoverCallbacks) {
      return;
    }
    if (!targetContext || !targetContext.item) {
      this.clearHoverExpandTimer();
      return;
    }
    const itemId = this.getItemId(targetContext.item);
    const isCollapsible =
      this.hoverCallbacks.hasChildren(targetContext.item) && !this.hoverCallbacks.getItemExpanded(targetContext.item);
    if (!isCollapsible || !itemId) {
      this.clearHoverExpandTimer();
      return;
    }
    if (this.hoverExpandTargetId !== itemId) {
      this.clearHoverExpandTimer();
      this.hoverExpandTargetId = itemId;
      this.hoverExpandTimer = setTimeout(() => {
        this.hoverCallbacks?.openCloseSection(itemId);
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

  private getItemId(item: TreeItem | null | undefined): string | null {
    if (!item) { return null; }
    if (this.isHelpTextSection(item) || this.isHelpTextStep(item)) {
      return this.getItemSelectionId(item) || null;
    }
    if (this.isAbbreviation(item)) {
      return item.abbreviation || null;
    }
    return (
      this.getStringProperty(item, 'id')
      ?? this.getStringProperty(item, 'key')
      ?? this.getStringProperty(item, 'titleKey')
      ?? this.getStringProperty(item, 'value')
    );
  }

  private getStringProperty(item: unknown, property: string): string | null {
    if (!item || typeof item !== 'object') { return null; }
    if (!(property in item)) { return null; }
    const value = (item as Record<string, unknown>)[property];
    return typeof value === 'string' ? value : null;
  }

  private isCoverContainer(container: string | null | undefined): boolean {
    return container === 'coversheet';
  }
}

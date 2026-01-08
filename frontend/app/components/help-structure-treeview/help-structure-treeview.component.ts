import {
  CdkDragDrop,
  CdkDragEnter,
  CdkDragExit,
  CdkDragEnd,
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
  AbbreviationItem,
  isNonNestableType,
  getSectionSelectionId
} from '~models/help-text-structure.model';
import { ContextMenuComponent, ContextMenuItem } from '../context-menu/app-context-menu.component';
import {
  DropContainerContext,
  MoveEvent,
  TreeDragDropService,
  TreeItem
} from './tree-drag-drop.service';

type ParentType = HelpTextSection | MainHelpSection | HelpTextStep;

@Component({
  selector: 'app-help-structure-treeview',
  templateUrl: './help-structure-treeview.component.html',
  styleUrls: ['./help-structure-treeview.component.scss'],
  providers: [TreeDragDropService],
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
  connectedDropListIds: string[] = [];
  listEnterPredicate = this.dragDrop.listEnterPredicate;
  childEnterPredicate = this.dragDrop.childEnterPredicate;
  constrainY = this.dragDrop.constrainY;
  trackByItem = this.dragDrop.trackByItem;
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

  constructor(private dragDrop: TreeDragDropService) {
    this.expandedSections = [];
    this.dragDrop.configureHoverCallbacks({
      openCloseSection: (id: string) => this.onOpenCloseSection(id),
      getItemExpanded: (item: TreeItem) => this.getItemExpanded(item),
      hasChildren: (item: TreeItem) => this.hasChildren(item as any)
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['topLevelKey'] && !changes['topLevelKey'].firstChange
      && changes['topLevelKey'].currentValue !== changes['topLevelKey'].previousValue) {
      this.expandedSections = [];
    }

    const selectedId = getSectionSelectionId(this.selectedHelpSection);
    if (selectedId) {
      this.expandToSelectedSection(selectedId);
    }
  }

  ngAfterViewInit(): void {
    this.dragDrop.registerDropLists(this.dropLists);
    this.dragDrop.registerTreeRoot(this.treeRootRef);
    this.dragDrop.registerTreeRows(this.treeRows);
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
    if (this.isCoverContainer(container)) {
      return;
    }
    this.moveSection.emit({ parent, container, index, direction });
  }

  public onMoveClick(event: MouseEvent, parent: ParentType, container: string, index: number, direction: 'up' | 'down') {
    event.preventDefault();
    event.stopPropagation();
    this.onMove(parent, container, index, direction);
  }

  onDrop(event: CdkDragDrop<DropContainerContext>) {
    this.dragDrop.debugLogging = this.debugLogging;
    const moveEvent = this.dragDrop.onDrop(event);
    if (moveEvent) {
      this.moveSection.emit(moveEvent);
    }
  }

  onDragStarted(event: CdkDragStart) {
    this.dragDrop.debugLogging = this.debugLogging;
    this.dragDrop.onDragStarted(event, this.helpItem);
  }

  onDragEnded(event: CdkDragEnd) {
    this.dragDrop.debugLogging = this.debugLogging;
    this.dragDrop.onDragEnded(event);
  }

  onDragMoved(event: CdkDragMove) {
    this.dragDrop.debugLogging = this.debugLogging;
    this.dragDrop.onDragMoved(event);
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

    if (!this.isCoverContainer(container)) {
      items.push({ label: 'Move up', action: 'moveUp', disabled: !hasContainer || index === 0 });
      items.push({ label: 'Move down', action: 'moveDown', disabled: !hasContainer || index >= collection.length - 1 });
    }

    if (this.isHelpTextSection(section)) {
      const canAddSubsection = this.canAddSubsection(section);
      const canAddContent = this.canAddContent(section);
      if (canAddSubsection) {
        items.push({ label: 'Add subsection', action: 'addSubsection' });
      }
      if (canAddContent) {
        items.push({ label: 'Add content', action: 'addContent' });
      }
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

  hasChildren(section: HelpTextSection | HelpTextStep) {
    if (section instanceof HelpTextSection) {
      return (section as HelpTextSection).hasChildren();
    }

    if (section instanceof HelpTextStep) {
      return !!section.substeps && section.substeps.length > 0;
    }

    return false;
  }

  onOpenCloseSection(sectionId: string | null) {
    if (!sectionId) {
      return;
    }
    if (this.expandedSections.find(x => x === sectionId)) {
      // console.log("closing ", section);
      this.expandedSections = this.expandedSections.filter(item => item !== sectionId);
    } else {
      // console.log("expanding ", section);
      this.expandedSections.push(sectionId);
    }

  }

  getItemExpanded(section) {
    const sectionId = this.getItemSelectionId(section);
    return !!sectionId && !!this.expandedSections.find(x => x === sectionId);
  }

  getTreeIcon(section: HelpTextSection | HelpTextStep): string {
    return this.getItemExpanded(section) ? 'expand_more' : 'chevron_right';
  }

  isSelectedSection(section) {
    const selectedId = getSectionSelectionId(this.selectedHelpSection);
    const sectionId = this.getItemSelectionId(section);
    return !!selectedId && selectedId === sectionId;
  }

  private canAddSubsection(section: HelpTextSection): boolean {
    if (!section) {
      return false;
    }
    if (isNonNestableType(section.type)) {
      return false;
    }
    return !this.showStepControls(section);
  }

  private canAddContent(section: HelpTextSection): boolean {
    if (!section) {
      return false;
    }
    if (!isNonNestableType(section.type)) {
      return true;
    }
    return this.isInstructionType(section.type);
  }

  private isInstructionType(type?: string): boolean {
    return type === HelpContentType.INSTRUCTION || type === HelpContentType.INSTRUCTION_BOLD;
  }

  onDropListEntered(event: CdkDragEnter<DropContainerContext>) {
    this.dragDrop.debugLogging = this.debugLogging;
    this.dragDrop.onDropListEntered(event);
  }

  onDropListExited(event: CdkDragExit<DropContainerContext>) {
    this.dragDrop.debugLogging = this.debugLogging;
    this.dragDrop.onDropListExited(event);
  }

  isChildDropActive(section: TreeItem, container: string): boolean {
    return this.dragDrop.isChildDropActive(section, container);
  }

  canAcceptChildDrop(section: ParentType, container: string): boolean {
    return this.dragDrop.canAcceptChildDrop(section, container);
  }

  canMoveUp(parent: ParentType, container: string, index: number): boolean {
    return this.dragDrop.canMoveUp(parent, container, index);
  }

  canMoveDown(parent: ParentType, container: string, index: number): boolean {
    return this.dragDrop.canMoveDown(parent, container, index);
  }

  getDefaultChildContainer(section: TreeItem): string | null {
    return this.dragDrop.getDefaultChildContainer(section);
  }

  getDropListId(context?: DropContainerContext | null): string | null {
    return this.dragDrop.getDropListId(context);
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

    const nodeId = this.getItemSelectionId(node);
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

  getConnectedDropListIds(currentId: string | null): string[] {
    this.connectedDropListIds = this.dragDrop.connectedDropListIds;
    return this.dragDrop.getConnectedDropListIds(currentId);
  }

  getParentKey(parent: ParentType): string {
    return this.dragDrop.getParentKey(parent);
  }

  getItemKey(item: TreeItem | null | undefined): string {
    return this.dragDrop.getItemKey(item);
  }

  getViewCollection(parent: ParentType, container: string): any[] {
    return this.dragDrop.getViewCollection(parent, container);
  }

  showStepControls(section: HelpTextSection): boolean {
    return this.dragDrop.showStepControls(section);
  }

  isHelpTextSection(item: ParentType | TreeItem): item is HelpTextSection {
    return this.dragDrop.isHelpTextSection(item);
  }

  isHelpTextStep(item: TreeItem): item is HelpTextStep {
    return this.dragDrop.isHelpTextStep(item);
  }

  isAbbreviation(item: TreeItem): item is AbbreviationItem {
    return this.dragDrop.isAbbreviation(item);
  }

  isMainHelpSection(item: ParentType): item is MainHelpSection {
    return this.dragDrop.isMainHelpSection(item);
  }

  private isCoverContainer(container: string | null | undefined): boolean {
    return container === 'coversheet';
  }
}

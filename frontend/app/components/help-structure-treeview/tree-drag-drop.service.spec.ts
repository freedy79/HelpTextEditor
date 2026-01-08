import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { HelpContentType, HelpTextSection } from '~models/help-text-structure.model';
import { DropContainerContext, DragContext, TreeDragDropService } from './tree-drag-drop.service';

describe('TreeDragDropService', () => {
  let service: TreeDragDropService;

  beforeEach(() => {
    service = new TreeDragDropService();
    service.debugLogging = false;
  });

  it('rejects list drops into cover containers', () => {
    const parent = new HelpTextSection();
    parent.type = HelpContentType.INTRODUCTION;
    const dragged = new HelpTextSection();
    dragged.type = HelpContentType.INTRODUCTION;
    parent.content = [dragged];

    const dragContext: DragContext = { item: dragged, parent, container: 'content', index: 0 };
    const dropData: DropContainerContext = { parent, container: 'coversheet', mode: 'list' };

    expect(service.canEnterDropListContext(dragContext, dropData, 'list')).toBeFalsy();
  });

  it('rejects child drops for non-nestable sections', () => {
    const dragParent = new HelpTextSection();
    dragParent.type = HelpContentType.INTRODUCTION;
    const dragged = new HelpTextSection();
    dragged.type = HelpContentType.INTRODUCTION;
    dragParent.content = [dragged];

    const targetParent = new HelpTextSection();
    targetParent.type = HelpContentType.INSTRUCTION;
    targetParent.subsections = [];

    const dragContext: DragContext = { item: dragged, parent: dragParent, container: 'content', index: 0 };
    const dropData: DropContainerContext = { parent: targetParent, container: 'subsections', mode: 'child' };

    expect(service.canEnterDropListContext(dragContext, dropData, 'child')).toBeFalsy();
  });

  it('moves items within a list based on the drop indicator', () => {
    const parent = new HelpTextSection();
    parent.type = HelpContentType.INTRODUCTION;
    const itemA = new HelpTextSection();
    itemA.type = HelpContentType.INTRODUCTION;
    const itemB = new HelpTextSection();
    itemB.type = HelpContentType.INTRODUCTION;
    const itemC = new HelpTextSection();
    itemC.type = HelpContentType.INTRODUCTION;
    parent.content = [itemA, itemB, itemC];

    service.setDropIndicatorForTest({ parent, container: 'content', index: 2, position: 'below' });

    const event = {
      previousContainer: { data: { parent, container: 'content', mode: 'list' } },
      container: { data: { parent, container: 'content', mode: 'list' } },
      item: { data: { item: itemB, parent, container: 'content', index: 1 } },
      previousIndex: 1,
      currentIndex: 2,
    } as unknown as CdkDragDrop<DropContainerContext>;

    const moveEvent = service.onDrop(event);

    expect(parent.content).toEqual([itemA, itemC, itemB]);
    expect(moveEvent?.newIndex).toBe(3);
  });

  it('transfers items between lists in the target order', () => {
    const sourceParent = new HelpTextSection();
    sourceParent.type = HelpContentType.INTRODUCTION;
    const targetParent = new HelpTextSection();
    targetParent.type = HelpContentType.INTRODUCTION;
    const itemA = new HelpTextSection();
    itemA.type = HelpContentType.INTRODUCTION;
    const itemB = new HelpTextSection();
    itemB.type = HelpContentType.INTRODUCTION;
    sourceParent.content = [itemA];
    targetParent.content = [itemB];

    service.setDropIndicatorForTest(null);

    const event = {
      previousContainer: { data: { parent: sourceParent, container: 'content', mode: 'list' } },
      container: { data: { parent: targetParent, container: 'content', mode: 'list' } },
      item: { data: { item: itemA, parent: sourceParent, container: 'content', index: 0 } },
      previousIndex: 0,
      currentIndex: 0,
    } as unknown as CdkDragDrop<DropContainerContext>;

    const moveEvent = service.onDrop(event);

    expect(sourceParent.content).toEqual([]);
    expect(targetParent.content).toEqual([itemA, itemB]);
    expect(moveEvent?.newIndex).toBe(0);
  });
});

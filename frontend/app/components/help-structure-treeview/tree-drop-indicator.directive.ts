import { Directive, HostBinding, Input } from '@angular/core';
import { DropContainerContext, TreeDragDropService } from './tree-drag-drop.service';

interface DropIndicatorContext extends DropContainerContext {
  index: number;
}

@Directive({
  selector: '[treeDropIndicator]'
})
export class TreeDropIndicatorDirective {
  @Input('treeDropIndicator') context: DropIndicatorContext | null = null;

  constructor(private dragDrop: TreeDragDropService) {}

  @HostBinding('class.drop-above')
  get dropAbove() {
    if (!this.context) { return false; }
    return this.dragDrop.isDropAbove(this.context.parent, this.context.container, this.context.index);
  }

  @HostBinding('class.drop-below')
  get dropBelow() {
    if (!this.context) { return false; }
    return this.dragDrop.isDropBelow(this.context.parent, this.context.container, this.context.index);
  }
}

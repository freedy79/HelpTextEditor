import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MenuItemModel } from './menu-item.model';

@Component({
  selector: 'app-header-menu',
  templateUrl: './header-menu.component.html',
  styleUrls: ['./header-menu.component.scss']
})
export class HeaderMenuComponent {

    @Input() items: MenuItemModel[];
    @Input() title: string;
    @Output() itemClicked: EventEmitter<any> = new EventEmitter();

    private currentHover: MenuItemModel;

    constructor() { }

    public selectItem(item) {
      if (item.clickId) {
        if (this.itemClicked) {
          this.itemClicked.emit(item);
        }
      }
    }

    public parentHovered(item) {
      return item === this.currentHover;
    }

    public hover_over(item) {
      this.currentHover = item;
    }
    public hover_out(item) {
      this.currentHover = {};
    }
}

import { Component, EventEmitter, Input, Output } from "@angular/core";
import { MenuItemModel } from "./menu-item.model";

@Component({
  selector: 'app-header-menu',
  templateUrl: './header-menu.component.html',
  styleUrls: ['./header-menu.component.scss']
})
export class HeaderMenuComponent {

    @Input() items: MenuItemModel[];
    @Input() title: string;
    @Output() onItemClicked: EventEmitter<any> = new EventEmitter();

    private currentHover: MenuItemModel;

    constructor() { }

    public selectItem(item) {
      if (item.clickId) {
        if (this.onItemClicked) {
          console.log("emit ", item.clickId);
          this.onItemClicked.emit(item);
        }
      }
    }

    public parentHovered(item) {
      return item == this.currentHover;
    }

    public hover_over(item) {
      this.currentHover = item;
    }
    public hover_out(item) {
      this.currentHover = {};
    }
}
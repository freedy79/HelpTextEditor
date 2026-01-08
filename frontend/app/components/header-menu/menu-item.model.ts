export interface MenuItemModel {
    text?: string;
    icon?: string;
    items?: MenuItemModel[];
    separator?: boolean;
    clickId?: string;
    enabled?: boolean;
}

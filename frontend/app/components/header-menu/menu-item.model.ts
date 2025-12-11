export interface MenuItemModel {
    text?: string;
    iconCss?: string;
    items?: MenuItemModel[];
    separator?: boolean;
    clickId?: string;
    enabled?: boolean;
}
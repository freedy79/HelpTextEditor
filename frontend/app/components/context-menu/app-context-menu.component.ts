import { Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output } from '@angular/core';

export interface ContextMenuItem {
  label: string;
  action: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-contextmenu',
  templateUrl: './app-context-menu.component.html',
  styleUrls: ['./app-context-menu.component.scss'],
})
export class ContextMenuComponent implements OnInit, OnDestroy {
  private _target: ElementRef;
  private _isOpen: boolean = false;
  private _positionX: number;
  private _positionY: number;

  @Input()
  public items: ContextMenuItem[] = [];

  @Output()
  public menuSelect = new EventEmitter<string>();

  @Input()
  public set target(a_oTarget: ElementRef) {
    this._target = a_oTarget;
  }

  public get isOpen(): boolean {
    return this._isOpen;
  }

  public get positionX(): number {
    return this._positionX;
  }

  public get positionY(): number {
    return this._positionY;
  }

  public ngOnInit(): void {
    /*if (this._target) {
      (this._target.nativeElement as HTMLElement).addEventListener('contextmenu', this.onContextMenu);
    }*/
  }

  public ngOnDestroy(): void {
    if (this._target) {
      (this._target.nativeElement as HTMLElement).removeEventListener('contextmenu', this.onContextMenu);
    }
  }

  public openContextMenu(positionX: number, positionY: number, items: ContextMenuItem[]): void {
    this._positionX = positionX;
    this._positionY = positionY;
    this.items = items;
    this._isOpen = true;
  }

  /**
   * Schließt das Kontextmenü.
   */
  closeContextMenu(): void {
    console.log("mouse left context");
    this._isOpen = false;
  }

  /**
   * Führt eine Aktion aus, wenn eine Option ausgewählt wird.
   * @param action Die gewählte Option.
   */
  menuAction(action: string, disabled?: boolean): void {
    if (disabled) { return; }
    this.menuSelect.emit(action);
    this.closeContextMenu();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeContextMenu();
  }
}

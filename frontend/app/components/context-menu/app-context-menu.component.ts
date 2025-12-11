import { Component, ElementRef, Input, OnDestroy, OnInit } from '@angular/core';

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
    (this._target.nativeElement as HTMLElement).removeEventListener('contextmenu', this.onContextMenu);
  }

  private onContextMenu = ($event: MouseEvent): void => {

    console.log('contextmenu clicked!');

    $event.preventDefault();

    this._positionX = $event.clientX;
    this._positionY = $event.clientY;

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
  menuAction(action: string): void {
    console.log(`Ausgewählte Aktion: ${action}`);
    this.closeContextMenu();
  }
}

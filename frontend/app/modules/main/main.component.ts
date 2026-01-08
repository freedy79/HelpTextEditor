import { AfterViewInit, Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { HelpEditorFacade } from '~/app/shared/services/help-editor-facade.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit, AfterViewInit {
  @ViewChild('previewContainer') previewContainer: ElementRef<HTMLDivElement>;

  constructor(public facade: HelpEditorFacade) { }

  ngOnInit(): void {
    this.facade.init();
  }

  ngAfterViewInit(): void {
    this.facade.setPreviewContainer(this.previewContainer);
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload($event: BeforeUnloadEvent) {
    this.facade.onBeforeUnload($event);
  }

  @HostListener('window:unload', ['$event'])
  beforeunload($event: any) {
    this.facade.beforeunload($event);
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(event: MouseEvent) {
    this.facade.onWindowMouseMove(event);
  }

  @HostListener('window:mouseup')
  onWindowMouseUp() {
    this.facade.onWindowMouseUp();
  }
}

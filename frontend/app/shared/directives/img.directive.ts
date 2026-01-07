import { Directive, ElementRef, HostListener, Input } from '@angular/core';

@Directive({
  selector: 'img[appDefault]'
})
export class ImageDefaultDirective {

  @Input() appDefault: string;
  @Input() fallback: string;

  private hasTriedDefault = false;
  private readonly placeholderSrc = 'assets/image-fallback.svg';
  private lastErrorMessage: string | null = null;

  constructor(private eRef: ElementRef) { }

  @HostListener('error')
  loadFallbackOnError() {
    const element: HTMLImageElement = this.eRef.nativeElement as HTMLImageElement;
    this.lastErrorMessage = `Bild nicht gefunden: ${element.currentSrc || element.src}`;

    if (!this.hasTriedDefault && this.appDefault) {
      this.hasTriedDefault = true;
      element.src = this.appDefault;
      return;
    }

    const fallbackSrc = this.fallback || this.placeholderSrc;
    if (element.src !== this.toAbsolutePath(fallbackSrc)) {
      element.src = fallbackSrc;
    }
  }

  @HostListener('load')
  clearErrorOnLoad() {
    const element: HTMLImageElement = this.eRef.nativeElement as HTMLImageElement;
    const fallbackSrc = this.toAbsolutePath(this.fallback || this.placeholderSrc);
    if (element.currentSrc !== fallbackSrc && element.src !== fallbackSrc) {
      this.lastErrorMessage = null;
    }
  }

  @HostListener('mouseenter')
  updateTitleOnHover() {
    const element: HTMLImageElement = this.eRef.nativeElement as HTMLImageElement;
    const currentPath = element.currentSrc || element.src;
    const message = [`Bildpfad: ${currentPath}`];
    if (this.lastErrorMessage) {
      message.push(this.lastErrorMessage);
    }
    element.title = message.join('\n');
  }

  private toAbsolutePath(path: string): string {
    const link = document.createElement('a');
    link.href = path;
    return link.href;
  }
}

import { Directive, ElementRef, HostListener, Input } from '@angular/core';

@Directive({
  selector: 'img[appDefault]'
})
export class ImageDefaultDirective {

  @Input() appDefault: string;
  @Input() fallback: string;

  private hasTriedDefault = false;
  private readonly placeholderSrc = 'assets/image-fallback.svg';

  constructor(private eRef: ElementRef) { }

  @HostListener('error')
  loadFallbackOnError() {
    const element: HTMLImageElement = this.eRef.nativeElement as HTMLImageElement;

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

  private toAbsolutePath(path: string): string {
    const link = document.createElement('a');
    link.href = path;
    return link.href;
  }
}

import { Directive, ElementRef, HostListener, Input } from '@angular/core';

@Directive({
    selector: 'img[default]'
  })
export class ImageDefault {

    @Input() default: string;
    @Input() fallback: string;

    private hasTriedDefault = false;
    private readonly placeholderSrc = 'assets/image-fallback.svg';

    constructor(private eRef: ElementRef) { }

    @HostListener('error')
    loadFallbackOnError() {
      const element: HTMLImageElement = <HTMLImageElement>this.eRef.nativeElement;

      if (!this.hasTriedDefault && this.default) {
        this.hasTriedDefault = true;
        element.src = this.default;
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

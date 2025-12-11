import { Directive, ElementRef, HostListener, Input } from '@angular/core';

@Directive({
    selector: 'img[default]'
  })
  export class ImageDefault {
  
    @Input() default: string;
  
    constructor(private eRef: ElementRef) { }
  
    @HostListener('error')
    loadFallbackOnError() {
      const element: HTMLImageElement = <HTMLImageElement>this.eRef.nativeElement;
      element.src = this.default;
  
      console.log(element.src);
    }
  }
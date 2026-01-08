import { Directive, ElementRef, HostListener, Input, OnChanges, SimpleChanges } from '@angular/core';

@Directive({
  selector: 'img[appDefault]'
})
export class ImageDefaultDirective implements OnChanges {

  @Input() appDefault: string;
  @Input() fallback: string;
  @Input() appLanguage: string;

  private candidateSources: string[] = [];
  private candidateIndex = -1;
  private readonly placeholderSrc = 'assets/image-fallback.svg';
  private lastErrorMessage: string | null = null;

  constructor(private eRef: ElementRef) { }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.appDefault || changes.fallback || changes.appLanguage) {
      this.refreshCandidates();
      this.lastErrorMessage = null;
    }
  }

  @HostListener('error')
  loadFallbackOnError() {
    const element: HTMLImageElement = this.eRef.nativeElement as HTMLImageElement;
    this.lastErrorMessage = `Bild nicht gefunden: ${element.currentSrc || element.src}`;

    if (!this.candidateSources.length) {
      this.refreshCandidates();
    }

    if (this.candidateIndex === -1) {
      this.candidateIndex = this.indexOfSource(element.currentSrc || element.src);
    }

    const nextIndex = this.candidateIndex + 1;
    if (nextIndex < this.candidateSources.length) {
      this.candidateIndex = nextIndex;
      element.src = this.candidateSources[nextIndex];
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

  private refreshCandidates() {
    const element: HTMLImageElement = this.eRef.nativeElement as HTMLImageElement;
    const basePath = this.stripExtension(this.appDefault || element.getAttribute('src') || '');
    if (!basePath) {
      this.candidateSources = [];
      this.candidateIndex = -1;
      return;
    }

    const candidates: string[] = [`${basePath}.svg`, `${basePath}.png`];
    const languageSuffix = this.normalizeLanguage(this.appLanguage);
    if (languageSuffix) {
      candidates.push(`${basePath}_${languageSuffix}.svg`, `${basePath}_${languageSuffix}.png`);
    }

    this.candidateSources = candidates;
    this.candidateIndex = this.indexOfSource(element.currentSrc || element.src);
  }

  private normalizeLanguage(language?: string): string | null {
    if (!language) {
      return null;
    }
    const normalized = language.toString().trim().toUpperCase();
    if (normalized.length < 2) {
      return null;
    }
    return normalized.slice(0, 2);
  }

  private stripExtension(path: string): string {
    return path.replace(/\.(svg|png)$/i, '');
  }

  private indexOfSource(source: string): number {
    const current = this.toAbsolutePath(source);
    return this.candidateSources.findIndex((candidate) => this.toAbsolutePath(candidate) === current);
  }
}

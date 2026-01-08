import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { shareReplay } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class QtfTranslationService {
  private cache = new Map<string, Observable<string>>();

  constructor(private translateService: TranslateService) {}

  get(key: string): Observable<string> {
    if (!key) {
      return of('');
    }

    const language = this.translateService.currentLang || this.translateService.defaultLang || '';
    const cacheKey = `${language}::${key}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const translation$ = this.translateService.get(key).pipe(
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.cache.set(cacheKey, translation$);
    return translation$;
  }
}

import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of, merge } from 'rxjs';
import { distinctUntilChanged, mapTo, startWith, switchMap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class QtfTranslationService {
  constructor(private translateService: TranslateService) { }

  get(key: string): Observable<string> {
    if (!key) return of('');

    const trigger$ = merge(
      this.translateService.onTranslationChange.pipe(mapTo(null)),
      this.translateService.onLangChange.pipe(mapTo(null))
    ).pipe(startWith(null));

    return trigger$.pipe(
      switchMap(() => this.translateService.get(key)),
      distinctUntilChanged()
    );
  }
}
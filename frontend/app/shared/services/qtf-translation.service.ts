import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class QtfTranslationService {
  constructor(private translateService: TranslateService) {}

  get(key: string): Observable<string> {
    if (!key) {
      return of('');
    }

    return this.translateService.stream(key);
  }
}

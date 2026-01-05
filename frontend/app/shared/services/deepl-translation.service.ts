import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class DeeplTranslationService {
  private readonly cookieName = 'deeplApiToken';
  private readonly endpoint = 'http://localhost:3000/api/translate/deepl';

  constructor(private http: HttpClient) {}

  translateText(text: string, sourceLang: string | undefined, targetLang: string, authKey: string): Observable<string> {
    return this.http.post<{ translations: Array<{ text: string }> }>(
      this.endpoint,
      { text, sourceLang, targetLang, authKey }
    ).pipe(
      map(response => response?.translations?.[0]?.text || '')
    );
  }

  storeAuthKey(authKey: string): void {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);

    const cookieValue = authKey
      ? `${this.cookieName}=${encodeURIComponent(authKey)};expires=${expires.toUTCString()};path=/;SameSite=Lax`
      : `${this.cookieName}=;expires=${new Date(0).toUTCString()};path=/;SameSite=Lax`;

    document.cookie = cookieValue;
  }

  getStoredAuthKey(): string | null {
    return this.getCookie(this.cookieName);
  }

  mapLanguageToDeepL(language: string): string | undefined {
    if (!language) {
      return undefined;
    }

    const normalized = language.toUpperCase();
    const mapping: { [key: string]: string } = {
      GERMAN: 'DE',
      ENGLISH: 'EN',
      FRENCH: 'FR',
      SPANISH: 'ES',
      ITALIAN: 'IT',
      JAPANESE: 'JA',
      RUSSIAN: 'RU',
      CHINESE: 'ZH',
      PORTUGUESE: 'PT-PT',
      KOREAN: 'KO'
    };

    return mapping[normalized];
  }

  private getCookie(name: string): string | null {
    const regex = new RegExp('(?:^|; )' + encodeURIComponent(name) + '=([^;]*)');
    const match = document.cookie.match(regex);
    return match ? decodeURIComponent(match[1]) : null;
  }
}

import { Pipe, PipeTransform } from '@angular/core';
import { Observable, combineLatest, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { FontService } from '../services/font.service';
import { QtfTranslationService } from '../services/qtf-translation.service';

@Pipe({
  name: 'qtfTranslate',
  pure: true
})
export class QtfTranslationPipe implements PipeTransform {
  private bracketRegex = /(\<(?!.*\>))/g;

  constructor(private qtfTranslationService: QtfTranslationService, private fontService: FontService) {}

  transform(value: string, args?: string[], type?: string, replaceSymbol: boolean = true): Observable<string> {
    if (typeof value === 'number') {
      return of(value as unknown as string);
    }

    if (!value) {
      return of('');
    }

    if (!type && !args) {
      return this.translateValue(value, replaceSymbol, false);
    }

    if (args && !type) {
      return this.translateWithArgs(value, args, replaceSymbol);
    }

    if (args && type === 'SELECTION') {
      return this.translateSelection(value, args);
    }

    return of(value);
  }

  private translateValue(value: string, replaceSymbol: boolean, allowAnyFont: boolean): Observable<string> {
    if ((allowAnyFont || value.includes('_FONT')) && this.fontService.isFontAvailable(value)) {
      return of(this.fontService.getFontCode(value));
    }

    return this.qtfTranslationService.get(value).pipe(
      map(res => this.handleBracketReplacement(res, replaceSymbol))
    );
  }

  private translateWithArgs(value: string, args: string[], replaceSymbol: boolean): Observable<string> {
    const base$ = this.translateValue(value, replaceSymbol, true);
    if (!args.length) {
      return base$;
    }

    const argTranslations$ = args.map(arg => {
      if (this.fontService.isFontAvailable(arg)) {
        return of(this.fontService.getFontCode(arg));
      }

      if (arg === '') {
        return of('');
      }

      return this.qtfTranslationService.get(arg).pipe(
        map(argValue => this.handleBracketReplacement(argValue, replaceSymbol))
      );
    });

    return combineLatest([base$, ...argTranslations$]).pipe(
      map(([baseValue, ...translatedArgs]) => {
        return translatedArgs.reduce((currentValue, translatedArg, index) => {
          const wildcard = `%arg${index}%`;
          return currentValue.replace(wildcard, translatedArg);
        }, baseValue as string);
      })
    );
  }

  private translateSelection(value: string, args: string[]): Observable<string> {
    return this.qtfTranslationService.get(value).pipe(
      map(resolvedValue => {
        return args.reduce((currentValue, arg, index) => {
          const wildcard = `%arg${index}%`;
          return currentValue.replace(wildcard, arg);
        }, resolvedValue as string);
      })
    );
  }

  private isValidHTML(elementToCheck: string) {
    try {
      return document.createElement(elementToCheck.toUpperCase()).toString() !== '[object HTMLUnknownElement]';
    } catch (e) {
      return false;
    }
  }

  private handleBracketReplacement(value: string, shouldBeReplaced: boolean) {
    if (shouldBeReplaced && !(value.includes('</') || value.includes('/>'))) {
      value = value.replace(this.bracketRegex, '&lt;');
      const possibleTags = value.match(/<(.*?)>/);
      if (possibleTags !== null) {
        if (!this.isValidHTML(possibleTags.pop())) {
          value = value.replace(/</g, '&lt;');
        }
      }
    }
    return value;
  }
}

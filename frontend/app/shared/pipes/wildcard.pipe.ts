
import { Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { FontService } from '../services/font.service';

@Pipe({
  name: 'qtfTranslate',
  pure: false
})
export class QtfTranslationPipe implements PipeTransform {
  private bracketRegex = /(\<(?!.*\>))/g;
  
  constructor(private translateService: TranslateService, private fontService: FontService) {
  
  }

  transform(value: string, args?: any, type?: any, replaceSymbol: boolean = true) {
    let returnValue = value;
    if (typeof value === 'number') {
      return value;
    }
    if (!value) {
      returnValue = '';
      return returnValue;
    } else if (value === '') {
      returnValue = value;
      return returnValue;
    } else if (!type && !args) {
        if (value.includes('_FONT') && this.fontService.isFontAvailable(value)) {
            returnValue = this.fontService.getFontCode(value);
          } else {
            this.translateService.get(value).subscribe(res => {
              returnValue = this.handleBracketReplacement(res, replaceSymbol);
            });
          }
    } else if (args && !type) {
      if (this.fontService.isFontAvailable(value)) {
        returnValue = this.fontService.getFontCode(value);
      } else {
        this.translateService.get(value).subscribe(res => {
            returnValue = this.handleBracketReplacement(res, replaceSymbol);
        });
      }
      args.forEach((arg, i) => {
        let wildcard = '%arg' + i + '%';
        let replaceValue = arg;
        if (this.fontService.isFontAvailable(arg)) {
          replaceValue = this.fontService.getFontCode(arg);
        } else if (arg !== '') {
          this.translateService.get(arg).subscribe(argValue => {
            replaceValue = this.handleBracketReplacement(argValue, replaceSymbol);
          });
        }
        returnValue = returnValue.replace(wildcard, replaceValue);
      });
    } else if (args && type) {
      if (type === 'SELECTION') {
        this.translateService.get(value).subscribe(res => (returnValue = res));
        args.forEach((arg, i) => {
          let wildcard = '%arg' + i + '%';
          returnValue = returnValue.replace(wildcard, arg);
        });
      }
    }
    return returnValue;
  }

  private isValidHTML(elementToCheck: string) {
    try {
      return document.createElement(elementToCheck.toUpperCase()).toString() != '[object HTMLUnknownElement]';
    }
    catch(e) {
      return false;
    }
  }

  private handleBracketReplacement(value: string, shouldBeReplaced: boolean) {
    if (shouldBeReplaced && !(value.includes('</') || value.includes('/>'))) {
      value = value.replace(this.bracketRegex, '&lt;');
      let possibleTags = value.match(/<(.*?)>/);
      if (possibleTags != null) {
        if (!this.isValidHTML(possibleTags.pop())) {
          value = value.replace(/</g, '&lt;');
        }
      }
    }
    return value;
  }
}
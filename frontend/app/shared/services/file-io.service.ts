import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { QtfFile } from '../../models/qtf-file.model';
import { HelpTextRoot, parseHelpTextRoot } from '../../models/help-text-structure.model';

@Injectable({ providedIn: 'root' })
export class FileIOService {
  constructor(private http: HttpClient) { }

  // Lädt die gesamte helptexts.json aus src/assets/helptexts.json
  loadHelpTextStructure(): Observable<HelpTextRoot> {
    return this.http.get<any>('media/helpTexts.json').pipe(
      map(raw => parseHelpTextRoot(raw))
    );
  }

  loadQtfFile(): Observable<QtfFile> {
    return this.http.get<QtfFile>('media/HELPTEXT.qtf');
  }

  downloadJson(data: any, filename: string) {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

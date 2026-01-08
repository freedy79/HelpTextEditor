import { Injectable } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { HelpTextRoot } from '../../models/help-text-structure.model';
import { QtfFile } from '../../models/qtf-file.model';
import { FileIOService } from './file-io.service';

@Injectable({ providedIn: 'root' })
export class HelpTextDataService {
  constructor(private fileService: FileIOService) {}

  loadHelpTextStructure(): Observable<HelpTextRoot> {
    return this.fileService.loadHelpTextStructure();
  }

  loadQtfFile(): Observable<QtfFile> {
    return this.fileService.loadQtfFile();
  }

  loadHelpTextData(): Observable<{ helpTextRoot: HelpTextRoot; qtfFile: QtfFile }> {
    return forkJoin({
      helpTextRoot: this.loadHelpTextStructure(),
      qtfFile: this.loadQtfFile()
    });
  }
}

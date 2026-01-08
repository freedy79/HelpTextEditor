import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import {
  ImagePickerDialogComponent,
  ImagePickerDialogData
} from '~/app/dialogs/image-picker-dialog/image-picker-dialog.component';
import {
  DeeplSettingsDialogComponent,
  DeeplSettingsDialogResult
} from '~/app/dialogs/deepl-settings-dialog/deepl-settings-dialog.component';
import {
  CleanQtfDialogComponent,
  CleanQtfDialogResult
} from '~/app/dialogs/clean-qtf-dialog/clean-qtf-dialog.component';
import {
  TranslationIssuesDialogComponent,
  TranslationIssuesDialogResult
} from '~/app/dialogs/translation-issues-dialog/translation-issues-dialog.component';
import {
  AbbreviationDialogComponent,
  AbbreviationDialogResult
} from '~/app/dialogs/abbreviation-dialog/abbreviation-dialog.component';
import { AbbreviationItem, HelpTextRoot } from '~/app/models/help-text-structure.model';
import { QtfFile } from '~/app/models/qtf-file.model';

@Injectable({ providedIn: 'root' })
export class HelpEditorActionsService {
  constructor(private dialog: MatDialog) {}

  openImagePickerDialog(initialFilename: string): Observable<string | undefined> {
    const dialogData: ImagePickerDialogData = {
      initialFilename
    };

    return this.dialog.open(ImagePickerDialogComponent, {
      width: '600px',
      data: dialogData
    }).afterClosed();
  }

  openCleanQtfDialog(data: { unusedKeys: string[]; qtfFile: QtfFile }): Observable<CleanQtfDialogResult | undefined> {
    return this.dialog.open(CleanQtfDialogComponent, {
      width: '640px',
      data
    }).afterClosed();
  }

  openTranslationIssuesDialog(data: {
    helpTextRoot: HelpTextRoot | null;
    qtfFile: QtfFile | null;
    selectedLanguage: string;
    deeplToken: string;
  }): Observable<TranslationIssuesDialogResult | undefined> {
    return this.dialog.open(TranslationIssuesDialogComponent, {
      width: '720px',
      data
    }).afterClosed();
  }

  openDeeplSettingsDialog(data: {
    token: string;
    rememberToken: boolean;
  }): Observable<DeeplSettingsDialogResult | undefined> {
    return this.dialog.open(DeeplSettingsDialogComponent, {
      width: '520px',
      data
    }).afterClosed();
  }

  openAbbreviationDialog(data: {
    abbreviation?: AbbreviationItem;
    existingAbbreviations: AbbreviationItem[];
  }): Observable<AbbreviationDialogResult | undefined> {
    return this.dialog.open(AbbreviationDialogComponent, {
      width: '520px',
      data
    }).afterClosed();
  }
}

import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DeeplTranslationService } from '~shared/services/deepl-translation.service';
import { HelpTextRoot, MainHelpSection, HelpTextSection, HelpTextStep, HelpTextTable } from '~/app/models/help-text-structure.model';
import { QtfFile, QtfTextEntry, createNewQtfItem } from '~/app/models/qtf-file.model';

export interface TranslationIssuesDialogData {
  helpTextRoot: HelpTextRoot | null;
  qtfFile: QtfFile | null;
  selectedLanguage: string;
  deeplToken: string | null;
}

export interface TranslationIssuesDialogResult {
  qtfFile: QtfFile | null;
  isDirty: boolean;
}

interface EmptyTranslationIssue {
  key: string;
  error?: string;
  isTranslating?: boolean;
}

interface DoubledTranslationIssue {
  key: string;
  language: string;
  translation: string;
  autoTranslation: string;
}

@Component({
  selector: 'app-translation-issues-dialog',
  templateUrl: './translation-issues-dialog.component.html',
  styleUrls: ['./translation-issues-dialog.component.scss']
})
export class TranslationIssuesDialogComponent implements OnInit {
  emptyTranslationIssues: EmptyTranslationIssue[] = [];
  missingTextIds: string[] = [];
  doubledTranslationIssues: DoubledTranslationIssue[] = [];
  hasChanges = false;

  constructor(
    private dialogRef: MatDialogRef<TranslationIssuesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TranslationIssuesDialogData,
    private deeplTranslationService: DeeplTranslationService
  ) { }

  ngOnInit(): void {
    this.refreshIssues();
  }

  get noIssuesFound(): boolean {
    return this.emptyTranslationIssues.length === 0
      && this.missingTextIds.length === 0
      && this.doubledTranslationIssues.length === 0;
  }

  get hasLoadedData(): boolean {
    return !!this.data.helpTextRoot && !!this.data.qtfFile;
  }

  refreshIssues(): void {
    this.emptyTranslationIssues = [];
    this.missingTextIds = [];
    this.doubledTranslationIssues = [];

    if (!this.data.helpTextRoot) {
      return;
    }

    const usedKeys = this.collectUsedTextIds();
    const textEntries = this.data.qtfFile?.TEXTS || {};

    usedKeys.forEach(key => {
      const entry = textEntries[key];
      if (!entry) {
        this.missingTextIds.push(key);
        return;
      }

      const translation = entry.TRANSLATIONS?.[this.data.selectedLanguage];
      const autoTranslation = entry.AUTOTRANSLATIONS?.[this.data.selectedLanguage];

      if (!this.isNonEmpty(translation) && !this.isNonEmpty(autoTranslation)) {
        this.emptyTranslationIssues.push({ key });
      }

      if (this.isNonEmpty(translation) && this.isNonEmpty(autoTranslation)) {
        this.doubledTranslationIssues.push({
          key,
          language: this.data.selectedLanguage,
          translation: translation || '',
          autoTranslation: autoTranslation || ''
        });
      }
    });
  }

  canAutoTranslate(issue: EmptyTranslationIssue): boolean {
    if (!this.data.qtfFile || !this.data.qtfFile.TEXTS) {
      return false;
    }

    const entry = this.data.qtfFile.TEXTS[issue.key];
    const token = (this.data.deeplToken || '').trim();
    const targetLanguage = this.deeplTranslationService.mapLanguageToDeepL(this.data.selectedLanguage);
    const sourceTranslation = this.getSourceTranslation(entry);

    return !!(entry && token && targetLanguage && sourceTranslation);
  }

  autoTranslate(issue: EmptyTranslationIssue): void {
    issue.error = undefined;

    if (!this.canAutoTranslate(issue)) {
      issue.error = 'Keine Ausgangssprache oder kein DeepL-Token vorhanden.';
      return;
    }

    const token = (this.data.deeplToken || '').trim();
    const targetLanguage = this.deeplTranslationService.mapLanguageToDeepL(this.data.selectedLanguage);
    const entry = this.data.qtfFile?.TEXTS?.[issue.key];
    const sourceTranslation = this.getSourceTranslation(entry);

    if (!entry || !targetLanguage || !sourceTranslation || !token) {
      issue.error = 'Automatische Übersetzung ist aktuell nicht möglich.';
      return;
    }

    issue.isTranslating = true;

    this.deeplTranslationService.translateText(
      sourceTranslation.text,
      sourceTranslation.languageCode,
      targetLanguage,
      token
    ).subscribe({
      next: translatedText => {
        entry.TRANSLATIONS = entry.TRANSLATIONS || {};
        entry.AUTOTRANSLATIONS = entry.AUTOTRANSLATIONS || {};
        entry.TRANSLATIONS[this.data.selectedLanguage] = translatedText;
        entry.AUTOTRANSLATIONS[this.data.selectedLanguage] = translatedText;
        this.markDirty();
        this.refreshIssues();
      },
      error: (error) => {
        console.error('DeepL translation failed', error);
        const deeplErrorMessage = error?.error?.message || error?.message || '';
        const deeplDetails = error?.error?.details;
        const deeplMessageSuffix = deeplDetails
          ? `${deeplErrorMessage ? `${deeplErrorMessage} (${deeplDetails})` : deeplDetails}`
          : deeplErrorMessage;
        issue.error = deeplMessageSuffix
          ? `Automatische Übersetzung fehlgeschlagen. DeepL-Fehler: ${deeplMessageSuffix}`
          : 'Automatische Übersetzung fehlgeschlagen.';
      },
      complete: () => issue.isTranslating = false
    });
  }

  createMissingKey(key: string): void {
    const qtfFile = this.ensureQtfFile();
    if (!qtfFile.TEXTS[key]) {
      qtfFile.TEXTS[key] = createNewQtfItem(this.data.selectedLanguage, '');
      this.markDirty();
      this.refreshIssues();
    }
  }

  createAllMissingKeys(): void {
    this.missingTextIds.forEach(key => this.createMissingKey(key));
  }

  keepManualTranslation(issue: DoubledTranslationIssue): void {
    if (!this.data.qtfFile || !this.data.qtfFile.TEXTS) {
      return;
    }

    const entry = this.data.qtfFile.TEXTS[issue.key];
    if (entry?.AUTOTRANSLATIONS) {
      delete entry.AUTOTRANSLATIONS[issue.language];
      this.markDirty();
      this.refreshIssues();
    }
  }

  keepAutoTranslation(issue: DoubledTranslationIssue): void {
    if (!this.data.qtfFile || !this.data.qtfFile.TEXTS) {
      return;
    }

    const entry = this.data.qtfFile.TEXTS[issue.key];
    if (!entry) {
      return;
    }

    const autoTranslation = entry.AUTOTRANSLATIONS?.[issue.language];
    if (autoTranslation !== undefined) {
      entry.TRANSLATIONS = entry.TRANSLATIONS || {};
      entry.TRANSLATIONS[issue.language] = autoTranslation;
      delete entry.AUTOTRANSLATIONS[issue.language];
      this.markDirty();
      this.refreshIssues();
    }
  }

  close(): void {
    this.dialogRef.close({
      qtfFile: this.data.qtfFile,
      isDirty: this.hasChanges
    } as TranslationIssuesDialogResult);
  }

  private ensureQtfFile(): QtfFile {
    if (!this.data.qtfFile) {
      this.data.qtfFile = { TEXTS: {} } as QtfFile;
    }

    if (!this.data.qtfFile.TEXTS) {
      this.data.qtfFile.TEXTS = {};
    }

    return this.data.qtfFile;
  }

  private collectUsedTextIds(): Set<string> {
    const ids = new Set<string>();

    const addIfPresent = (value?: string) => {
      if (value) {
        ids.add(value);
      }
    };

    const processStep = (step?: HelpTextStep) => {
      if (!step) { return; }
      addIfPresent(step.value);
      step.substeps?.forEach(processStep);
    };

    const processSection = (section?: HelpTextSection) => {
      if (!section) { return; }

      const translationKey = typeof section.getTranslationKey === 'function'
        ? section.getTranslationKey()
        : section.value;
      addIfPresent(translationKey);

      if (section.type === 'TABLE') {
        const tableSection = section as HelpTextTable;
        tableSection.header?.forEach(addIfPresent);
        tableSection.rows?.forEach(row => row?.rowValues?.forEach(addIfPresent));
      }

      section.coversheet?.forEach(processSection);
      section.content?.forEach(processSection);
      section.subsections?.forEach(processSection);
      section.steps?.forEach(processStep);
    };

    const processMainSection = (section?: MainHelpSection) => {
      if (!section) { return; }

      section.coversheet?.forEach(processSection);
      section.content?.forEach(processSection);
      section.abbreviations?.forEach(abbr => {
        addIfPresent(abbr.abbreviation);
        addIfPresent(abbr.longDescription);
        addIfPresent(abbr.shortDescription);
      });
    };

    Object.values(this.data.helpTextRoot || {}).forEach(value => processMainSection(value as MainHelpSection));

    return ids;
  }

  private getSourceTranslation(entry: QtfTextEntry | null | undefined): { text: string; languageCode?: string } | null {
    if (!entry) {
      return null;
    }

    const preferredSources = ['GERMAN', 'ENGLISH'];
    for (const lang of preferredSources) {
      const text = entry.TRANSLATIONS?.[lang] || entry.AUTOTRANSLATIONS?.[lang];
      if (this.isNonEmpty(text) && lang !== this.data.selectedLanguage) {
        return { text: text as string, languageCode: this.deeplTranslationService.mapLanguageToDeepL(lang) };
      }
    }

    const combinedTranslations = { ...entry.TRANSLATIONS, ...entry.AUTOTRANSLATIONS };
    for (const [lang, text] of Object.entries(combinedTranslations)) {
      if (this.isNonEmpty(text) && lang !== this.data.selectedLanguage) {
        return { text: text as string, languageCode: this.deeplTranslationService.mapLanguageToDeepL(lang) };
      }
    }

    return null;
  }

  private isNonEmpty(value?: string | null): boolean {
    return !!value && value.toString().trim() !== '';
  }

  private markDirty(): void {
    this.hasChanges = true;
  }
}

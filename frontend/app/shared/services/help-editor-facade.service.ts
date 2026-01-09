import { ElementRef, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs/operators';
import {
  HelpTextRoot,
  MainHelpSection,
  HelpTextSection,
  HelpTextRootKey,
  HelpContentType,
  HelpTextStep,
  AbbreviationItem,
  isNonNestableType,
  HelpTextTable,
  TableCellSelection,
  TableCellValue,
  TableCellImage,
  getSectionSelectionId,
  getTableCellKey,
  isEnumerationContentType,
  isImageContentType,
  isInstructionContentType,
  isTableSection,
  isValuelessContentType,
  isTableCellImage
} from '~/app/models/help-text-structure.model';
import {
  parseHelpTextRoot,
  parseMainHelpSection,
  serializeHelpTextRoot
} from '~/app/models/help-text-serializer';
import { MenuItemModel } from '~/app/components/header-menu/menu-item.model';
import { buildInfo } from '~/app/build-info.generated';
import { ConfirmDialogService } from '~/app/dialogs/confirmation-dialog/confirmation-dialog.service';
import { FileIOService } from './file-io.service';
import { DeeplTranslationService } from './deepl-translation.service';
import { HelpTextDataService } from './help-text-data.service';
import { HelpEditorActionsService } from './help-editor-actions.service';
import { createNewQtfItem, QtfFile, QtfTextEntry, removeQtfItem, TextKey } from '../../models/qtf-file.model';
import {
  CoverageKeyUsage,
  CoverageLanguageReport,
  CoverageReference,
  CoverageReport
} from '~/app/models/coverage-report.model';

@Injectable({ providedIn: 'root' })
export class HelpEditorFacade {
  private readonly splitterStorageKey = 'help-text-editor:left-column-width';
  private previewContainer: ElementRef<HTMLDivElement> | null = null;

  helpTextRoot: HelpTextRoot | null = null;
  qtfFile: QtfFile | null = null;

  allowedKeys = [
    'APPLICATION',
    '_FILE_NAME',
    'TROUBLESHOOTING',
    'ABBREVIATION_TITLE',
    'SETTING_UP',
    'USER_STEPS',
    'APPENDIX',
    'PASSWORD',
    'OPEN_SETTINGS_MENU'
  ] as const;

  public showOverlayFileOpen = false;
  public showOverlayAddContent = false;

  languages = ['GERMAN', 'ENGLISH', 'FRENCH', 'CHINESE', 'RUSSIAN', 'SPANISH', 'ITALIAN', 'JAPANESE', 'KOREAN'];
  selectedLanguage = 'GERMAN';
  deeplAuthKey = '';
  isAutoTranslating = false;
  autoTranslationMessage = '';

  // Aktuell gewählter Top-Level-Key (z. B. HELP_TEXT_DEVICE_CONCEPT)
  selectedTopLevelKey: string | null = null;

  /**
   * Holds the currently selected main section. Drag/drop used to crash because this stayed null
   * after loading a file via the overlay; keep it initialized before tree interactions.
   */
  currentMainHelpSection: MainHelpSection = null;

  selectedSection: HelpTextSection | null = null;
  selectedContentKey: string | null = null;
  selectedTableCell: TableCellSelection | null = null;
  selectedTextContent = '';

  isDirty = false;
  appVersion = buildInfo.buildDateIso ? new Date(buildInfo.buildDateIso).toLocaleString() : 'Unknown';
  leftColumnWidth = 320;
  leftMinWidth = 220;
  leftMaxWidth = 700;
  isDraggingSplitter = false;
  dragStartX = 0;
  dragStartWidth = 0;

  // HTML-Preview des aktuell gewählten Top-Level-Teils
  previewHtml = '';

  public menuItems: MenuItemModel[] = [
    {
      text: 'File',
      icon: 'description',
      items: [
        { text: 'Open', icon: 'folder_open', clickId: 'openfile' },
        { text: 'Open asset', icon: 'image', clickId: 'openasset' },
        { text: 'Save', icon: 'save', clickId: 'savefile' },
        { separator: true },
        { text: 'DeepL Einstellungen', icon: 'settings', clickId: 'deeplSettings' }
      ]
    },
    {
      text: 'Insert',
      icon: 'add_circle',
      items: [
        { text: 'Help file', icon: 'help_outline', clickId: 'addHelpFile' },
        { text: 'Main section', icon: 'view_agenda', clickId: 'addMainSection' },
        { separator: true },
        { text: 'Subsection', icon: 'format_indent_increase', clickId: 'addSubsection' },
        { text: 'Content', icon: 'article', clickId: 'addContent' },
        { text: 'Step', icon: 'format_list_numbered', clickId: 'addStep' },
      ]
    },
    {
      text: 'Edit',
      icon: 'edit',
      items: [
        { text: 'Translation issues', icon: 'translate', clickId: 'translationIssues' },
        { text: 'Clean QTF', icon: 'cleaning_services', clickId: 'cleanQtf' },
        { text: 'Coverage', icon: 'fact_check', clickId: 'coverage' },
        { separator: true },
        { text: 'Copy', icon: 'content_copy', clickId: 'copy', enabled: false },
        { text: 'Delete', icon: 'delete', clickId: 'delete' }
      ]
    }
  ];

  constructor(
    private fileService: FileIOService,
    private translateService: TranslateService,
    private http: HttpClient,
    private deeplTranslationService: DeeplTranslationService,
    private confirmDialog: ConfirmDialogService,
    private dataService: HelpTextDataService,
    private actionsService: HelpEditorActionsService
  ) {}

  get coverageReport(): CoverageReport | null {
    if (!this.helpTextRoot || !this.qtfFile) {
      return null;
    }

    return this.buildCoverageReport(this.helpTextRoot, this.qtfFile);
  }

  init(): void {
    const storedKey = this.deeplTranslationService.getStoredAuthKey()?.trim();
    if (storedKey) {
      this.deeplAuthKey = storedKey;
    }
    this.loadStoredSplitterWidth();
  }

  setPreviewContainer(container: ElementRef<HTMLDivElement> | null): void {
    this.previewContainer = container;
  }

  onBeforeUnload($event: BeforeUnloadEvent) {
    if (this.isDirty) {
      $event.preventDefault();
      console.log('Triggered beforeunload');
      this.onSave();
    }
  }

  beforeunload($event: any) {
    if (this.isDirty) {
      console.log('Saving before unload');
      this.onSave();
    }
  }

  onWindowMouseMove(event: MouseEvent) {
    if (!this.isDraggingSplitter) {
      return;
    }

    const delta = event.clientX - this.dragStartX;
    const newWidth = Math.min(this.leftMaxWidth, Math.max(this.leftMinWidth, this.dragStartWidth + delta));
    this.leftColumnWidth = newWidth;
  }

  onWindowMouseUp() {
    if (!this.isDraggingSplitter) {
      return;
    }
    this.isDraggingSplitter = false;
    this.persistSplitterWidth();
  }

  private buildCoverageReport(root: HelpTextRoot, qtfFile: QtfFile): CoverageReport {
    const references = this.collectCoverageReferences(root);
    const usedKeys: CoverageKeyUsage[] = Array.from(references.entries())
      .map(([key, refs]) => ({
        key,
        references: [...refs].sort((a, b) => a.label.localeCompare(b.label))
      }))
      .sort((a, b) => a.key.localeCompare(b.key));

    const missingKeys = usedKeys.filter(item => !qtfFile.TEXTS?.[item.key]);
    const missingTranslations: CoverageLanguageReport[] = this.languages.map(language => ({
      language,
      missing: usedKeys.filter(item => this.isTranslationMissing(qtfFile.TEXTS?.[item.key], language))
    }));
    const duplicateKeys = usedKeys.filter(item => item.references.length > 1);
    const usedKeySet = new Set(usedKeys.map(item => item.key));
    const unusedQtfKeys = Object.keys(qtfFile.TEXTS || {})
      .filter(key => !usedKeySet.has(key))
      .sort((a, b) => a.localeCompare(b));

    return {
      usedKeys,
      missingKeys,
      missingTranslations,
      duplicateKeys,
      unusedQtfKeys
    };
  }

  private collectCoverageReferences(root: HelpTextRoot): Map<string, CoverageReference[]> {
    const references = new Map<string, CoverageReference[]>();

    const addReference = (key: string | null | undefined, reference: CoverageReference) => {
      if (!key) {
        return;
      }

      const existing = references.get(key);
      if (existing) {
        existing.push(reference);
      } else {
        references.set(key, [reference]);
      }
    };

    const formatSectionLabel = (section: HelpTextSection, parentPath?: string): string => {
      const displayKey = section.getTranslationKey()
        || section.value
        || section.imageDescription
        || section.linkId
        || getSectionSelectionId(section)
        || 'unknown';
      const typeLabel = section.type || 'SECTION';
      const current = `${typeLabel}:${displayKey}`;
      return parentPath ? `${parentPath} > ${current}` : current;
    };

    const processStep = (step: HelpTextStep, parentPath: string) => {
      addReference(step.value, {
        kind: 'HelpTextStep',
        label: `${parentPath} > STEP:${step.value}`
      });
      step.substeps?.forEach(substep => processStep(substep, `${parentPath} > STEP:${step.value}`));
    };

    const processTableCell = (cell: TableCellValue, locationLabel: string) => {
      const key = getTableCellKey(cell);
      if (!key) {
        return;
      }
      const cellType = isTableCellImage(cell) ? 'image' : 'text';
      addReference(key, {
        kind: 'Table',
        label: `${locationLabel} (${cellType})`
      });
    };

    const processSection = (section?: HelpTextSection, parentPath?: string) => {
      if (!section) {
        return;
      }

      const sectionPath = formatSectionLabel(section, parentPath);
      const translationKey = section.getTranslationKey();
      if (translationKey) {
        const isImage = isImageContentType(section.type);
        addReference(translationKey, {
          kind: isImage ? 'Image' : 'HelpTextSection',
          label: isImage
            ? `${sectionPath}${section.value ? ` (file: ${section.value})` : ''}`
            : sectionPath
        });
      }

      if (isTableSection(section)) {
        const tableSection = section as HelpTextTable;
        tableSection.header?.forEach((cell, index) =>
          processTableCell(cell, `${sectionPath} header[${index + 1}]`)
        );
        tableSection.rows?.forEach((row, rowIndex) => {
          row.rowValues?.forEach((cell, colIndex) =>
            processTableCell(cell, `${sectionPath} row ${rowIndex + 1} col ${colIndex + 1}`)
          );
        });
      }

      section.steps?.forEach(step => processStep(step, sectionPath));
      section.coversheet?.forEach(item => processSection(item, sectionPath));
      section.content?.forEach(item => processSection(item, sectionPath));
      section.subsections?.forEach(item => processSection(item, sectionPath));
    };

    root.forEachSection((section, key) => {
      const rootPath = `ROOT:${key}`;
      section.coversheet?.forEach(item => processSection(item, rootPath));
      section.content?.forEach(item => processSection(item, rootPath));
      section.abbreviations?.forEach(item => {
        addReference(item.abbreviation, {
          kind: 'Abbreviation',
          label: `${rootPath} > abbreviation`
        });
        addReference(item.shortDescription, {
          kind: 'Abbreviation',
          label: `${rootPath} > shortDescription`
        });
        addReference(item.longDescription, {
          kind: 'Abbreviation',
          label: `${rootPath} > longDescription`
        });
      });
    });

    return references;
  }

  private isTranslationMissing(entry: QtfTextEntry | undefined, language: string): boolean {
    if (!entry) {
      return true;
    }

    const translation = entry.TRANSLATIONS?.[language];
    const autoTranslation = entry.AUTOTRANSLATIONS?.[language];
    return !this.isNonEmptyTranslation(translation) && !this.isNonEmptyTranslation(autoTranslation);
  }

  private isNonEmptyTranslation(value?: string | null): boolean {
    return !!value && value.toString().trim() !== '';
  }

  onSplitterMouseDown(event: MouseEvent) {
    this.isDraggingSplitter = true;
    this.dragStartX = event.clientX;
    this.dragStartWidth = this.leftColumnWidth;
    event.preventDefault();
  }

  private loadStoredSplitterWidth() {
    if (typeof window === 'undefined') {
      return;
    }

    const storedWidth = window.localStorage.getItem(this.splitterStorageKey);
    if (!storedWidth) {
      return;
    }

    const parsedWidth = Number(storedWidth);
    if (Number.isNaN(parsedWidth)) {
      return;
    }

    this.leftColumnWidth = Math.min(this.leftMaxWidth, Math.max(this.leftMinWidth, parsedWidth));
  }

  private persistSplitterWidth() {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(this.splitterStorageKey, String(this.leftColumnWidth));
  }

  public onMenuItemClicked(item) {
    if (item.clickId === 'openfile') {
      this.openOverlayFileOpen();
    } else if (item.clickId === 'savefile') {
      this.onSave();
    } else if (item.clickId === 'openasset') {
      this.onLoadFromAsset();
    } else if (item.clickId === 'addMainSection') {
      this.createNewMainsection();
    } else if (item.clickId === 'addSubsection' && this.selectedSection) {
      if (this.canAddSubsectionForSection(this.selectedSection)) {
        this.createNewSubsection();
      } else {
        console.warn('Cannot add subsections for content type: ', this.selectedSection.type);
      }
    } else if (item.clickId === 'addContent' && this.selectedSection) {
      this.openOverlayAddContent();
    } else if (item.clickId === 'addStep' && this.selectedSection) {
      this.createNewStep();
    } else if (item.clickId === 'cleanQtf') {
      this.cleanQtf();
    } else if (item.clickId === 'translationIssues') {
      this.openTranslationIssuesDialog();
    } else if (item.clickId === 'coverage') {
      this.openCoverageDialog();
    } else if (item.clickId === 'copy') {
      this.copy();
    } else if (item.clickId === 'deeplSettings') {
      this.openDeeplSettingsDialog();
    }
  }

  openCoverageDialog(): void {
    this.actionsService.openCoverageDialog({
      coverageReport: this.coverageReport
    });
  }

  copy() {
    const apiUrl = 'http://localhost:3000/api/upload';

    const corsHeaders = new HttpHeaders({
      'Content-Type': 'application/text',
      'Accept': 'application/text',
      'Access-Control-Allow-Origin': 'http://localhost:3000'
    });

    console.log('send request');
    this.http.get(apiUrl, { headers: corsHeaders, responseType: 'text' }).subscribe(config => {
      console.log('Config: ', config);
    }, (error) => {
      console.error(error);
    });
  }

  onLoadFromAsset() {
    console.log('load asset');
    this.dataService.loadHelpTextData().subscribe(({ helpTextRoot, qtfFile }) => {
      this.helpTextRoot = helpTextRoot;
      const keys = this.getRootKeys();
      if (keys.length > 0) {
        this.onTopLevelChange(keys[0]);
      }
      this.qtfFile = qtfFile;
      this.loadTextsFromQtf(this.selectedLanguage);
    });
  }

  onSave() {
    this.saveCurrentSectionText();

    if (this.helpTextRoot) {
      this.fileService.downloadJson(serializeHelpTextRoot(this.helpTextRoot), 'helpTexts.json');
    }
    if (this.qtfFile) {
      this.fileService.downloadJson(this.qtfFile, 'HELPTEXT.qtf');
    }

    this.isDirty = false;
  }

  getRootKeys(): string[] {
    if (!this.helpTextRoot) { return []; }
    return this.helpTextRoot.getSectionKeys();
  }

  getSelectedItem(): MainHelpSection | null {
    if (this.currentMainHelpSection) {
      return this.currentMainHelpSection;
    }

    if (!this.helpTextRoot || !this.selectedTopLevelKey) { return null; }
    return (this.helpTextRoot as any)[this.selectedTopLevelKey] as MainHelpSection;
  }

  onSelectTreeViewItem(event) {
    if (event) {
      this.onSelectSection(event as string);

      const elementId = this.getSelectedSectionId() || (event as string);
      this.scrollToSectionIfHidden(elementId);
    }
  }

  onAddSubsection(section: HelpTextSection) {
    this.selectedSection = section;
    this.syncSelectionForContextAction(section);
    if (this.canAddSubsectionForSection(section)) {
      this.createNewSubsection();
    } else {
      console.warn('Cannot add subsections for content type: ', section?.type);
    }
  }

  private scrollToSectionIfHidden(elementId: string | null) {
    if (!elementId) {
      return;
    }

    const sectionElement = document.getElementById(elementId);
    if (!sectionElement) {
      return;
    }

    const container = this.previewContainer?.nativeElement;
    if (container) {
      const sectionBounds = sectionElement.getBoundingClientRect();
      const containerBounds = container.getBoundingClientRect();
      const isFullyVisible = sectionBounds.top >= containerBounds.top && sectionBounds.bottom <= containerBounds.bottom;

      if (!isFullyVisible) {
        sectionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    sectionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  onAddContent(section: HelpTextSection | MainHelpSection) {
    if (!section) { return; }
    this.syncSelectionForContextAction(section);
    this.openOverlayAddContent();
  }

  private canAddSubsectionForSection(section?: HelpTextSection | null): boolean {
    if (!section) {
      return false;
    }
    if (isNonNestableType(section.type)) {
      return false;
    }
    return !this.isEnumerationType(section.type);
  }

  private canAddContentToSection(section?: HelpTextSection | null): boolean {
    if (!section) {
      return false;
    }
    if (!isNonNestableType(section.type)) {
      return true;
    }
    return this.isInstructionType(section.type);
  }

  private isEnumerationType(type?: HelpContentType | string): boolean {
    return isEnumerationContentType(type);
  }

  private isInstructionType(type?: HelpContentType | string): boolean {
    return isInstructionContentType(type);
  }

  onAddStep(section: HelpTextSection) {
    this.syncSelectionForContextAction(section);
    this.createNewStep();
  }

  private syncSelectionForContextAction(section: HelpTextSection | MainHelpSection) {
    const selectionId = getSectionSelectionId(section as HelpTextSection);
    if (selectionId) {
      this.onSelectSection(selectionId);
      return;
    }

    this.selectedSection = section as HelpTextSection;
    this.selectedTableCell = null;
    this.selectedContentKey = null;
    const translationKey = this.selectedSection?.getTranslationKey?.() || null;
    this.loadTextFromQtf(translationKey);
  }

  onAddAbbreviation(mainSection: MainHelpSection) {
    if (!mainSection) { return; }

    this.actionsService.openAbbreviationDialog({
      existingAbbreviations: this.getAllAbbreviations()
    }).subscribe((result) => {
      if (!result?.abbreviation) { return; }

      const targetSection = this.currentMainHelpSection || mainSection;
      if (!targetSection.abbreviations) {
        targetSection.abbreviations = [];
      }
      targetSection.abbreviations.push(result.abbreviation);

      this.ensureAbbreviationQtfEntries(result.abbreviation, null);
      this.persistAbbreviationChange(targetSection);
    });
  }

  onEditAbbreviation(event: { abbreviation: AbbreviationItem; parent: MainHelpSection; index: number; }) {
    if (!event || !event.abbreviation) { return; }
    this.actionsService.openAbbreviationDialog({
      abbreviation: event.abbreviation,
      existingAbbreviations: this.getAllAbbreviations()
    }).subscribe((result) => {
      if (!result?.abbreviation) { return; }
      const targetSection = this.currentMainHelpSection || event.parent;
      if (!targetSection) { return; }

      if (!targetSection.abbreviations) {
        targetSection.abbreviations = [];
      }

      const index = (typeof event.index === 'number') ? event.index : targetSection.abbreviations.indexOf(event.abbreviation);
      if (index < 0) { return; }

      const previous = targetSection.abbreviations[index];
      targetSection.abbreviations[index] = result.abbreviation;

      this.ensureAbbreviationQtfEntries(result.abbreviation, previous);
      this.persistAbbreviationChange(targetSection);
    });
  }

  onDeleteAbbreviation(event: { abbreviation: AbbreviationItem; parent: MainHelpSection; }) {
    if (!event || !event.abbreviation || !event.parent) { return; }

    const confirmed = confirm(`Abkürzung \"${event.abbreviation.abbreviation}\" löschen?`);
    if (!confirmed) { return; }

    const targetSection = this.currentMainHelpSection || event.parent;
    targetSection.abbreviations = (targetSection.abbreviations || []).filter(ab => ab !== event.abbreviation);

    this.persistAbbreviationChange(targetSection);
  }

  async onDeleteTreeSection(section: HelpTextSection | HelpTextStep) {
    await this.deleteItem(section);
  }

  onMoveSection(event: {
    parent: HelpTextSection | MainHelpSection | HelpTextStep;
    container: string;
    index: number;
    direction?: 'up' | 'down';
    newIndex?: number;
    fromParent?: HelpTextSection | MainHelpSection | HelpTextStep;
    fromContainer?: string;
  }) {
    const ensuredSection = this.ensureCurrentMainSection();
    if (!ensuredSection) {
      console.warn('Move section aborted: no current main section available', event);
      return;
    }

    if (!event || !event.parent || !event.container) {
      console.log('Move section aborted: missing event data', event);
      return;
    }

    const movedMainSection = this.tryMoveMainSection(event);
    if (movedMainSection) {
      this.afterSectionMoved(movedMainSection);
      return;
    }

    const sourceParent = event.fromParent || event.parent;
    const sourceContainer = event.fromContainer || event.container;
    const sourceCollection = (sourceParent as any)[sourceContainer] as any[];
    if (!sourceCollection || event.index < 0 || event.index >= sourceCollection.length) {
      console.log('Move section aborted: invalid source collection or index', event);
      return;
    }

    const [item] = sourceCollection.splice(event.index, 1);

    const targetParent = event.parent;
    const targetContainer = event.container;
    if (!(targetParent as any)[targetContainer]) {
      (targetParent as any)[targetContainer] = [];
    }
    const targetCollection = (targetParent as any)[targetContainer] as any[];

    const requestedIndex = (typeof event.newIndex === 'number')
      ? event.newIndex
      : (event.direction === 'up' ? event.index - 1 : event.index + 1);

    const targetIndex = Math.max(0, Math.min(requestedIndex, targetCollection.length));

    if (targetIndex < 0 || targetIndex > targetCollection.length) {
      console.log('Move section aborted: target index out of range', { targetIndex, event });
      sourceCollection.splice(event.index, 0, item);
      return;
    }

    targetCollection.splice(targetIndex, 0, item);

    this.afterSectionMoved(item);
  }

  private tryMoveMainSection(event: {
    parent: HelpTextSection | MainHelpSection | HelpTextStep;
    container: string;
    index: number;
    direction?: 'up' | 'down';
    newIndex?: number;
  }): HelpTextSection | null {
    if (!(event.parent instanceof MainHelpSection)) {
      return null;
    }

    if (event.container !== 'content' && event.container !== 'coversheet') {
      return null;
    }

    const collection = (event.parent as any)[event.container] as HelpTextSection[] | undefined;
    if (!collection || event.index < 0 || event.index >= collection.length) {
      return null;
    }

    const requestedIndex = typeof event.newIndex === 'number'
      ? event.newIndex
      : event.direction === 'up'
        ? event.index - 1
        : event.index + 1;

    const targetIndex = Math.max(0, Math.min(requestedIndex, collection.length - 1));
    if (targetIndex === event.index) {
      return collection[event.index];
    }

    const [item] = collection.splice(event.index, 1);
    collection.splice(targetIndex, 0, item);

    return item;
  }

  private afterSectionMoved(item: HelpTextSection | HelpTextStep | undefined) {
    this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;
    this.saveCurrentSectionText();
    this.isDirty = true;

    const selectionId = getSectionSelectionId(item as HelpTextSection | HelpTextStep);
    if (selectionId) {
      this.onSelectSection(selectionId);
    }
  }

  onSelectSection(contentId: string | TableCellSelection) {
    const activeMainSection = this.ensureCurrentMainSection();
    if (!activeMainSection || contentId === '') {
      console.log('currenthelp text item is undefined.');
      this.selectedSection = undefined;
      this.selectedContentKey = null;
      this.selectedTableCell = null;
      return;
    }

    this.saveCurrentSectionText();
    this.autoTranslationMessage = '';

    console.log('Selection: ', contentId);
    if (typeof contentId !== 'string') {
      const tableSection = activeMainSection.findSectionById(contentId.tableId);
      if (!tableSection) {
        console.error('Could not find table ', contentId.tableId, ' in ', this.currentMainHelpSection);
        return;
      }

      this.selectedSection = tableSection;
      this.selectedTableCell = contentId;
      const cellValue = this.getTableCellValue(tableSection as HelpTextTable, contentId);
      this.syncSelectedTableCellKey(cellValue);
      this.loadTextFromQtf(this.selectedContentKey);
      return;
    }

    this.selectedSection = activeMainSection.findSectionById(contentId);
    if (!this.selectedSection) {
      console.error('Could not find ', contentId, ' in ', this.currentMainHelpSection);
      return;
    }

    if (isTableSection(this.selectedSection)) {
      const table = this.selectedSection as HelpTextTable;
      this.selectedTableCell = this.findTableCellContext(table, contentId);
      const cellValue = this.selectedTableCell ? this.getTableCellValue(table, this.selectedTableCell) : null;
      this.syncSelectedTableCellKey(cellValue);
      this.loadTextFromQtf(this.selectedContentKey);
      return;
    }

    this.selectedTableCell = null;
    this.selectedContentKey = null;
    this.loadTextFromQtf(this.selectedSection.getTranslationKey());
  }

  onLanguageChange(event) {
    const nextLanguage = event || this.selectedLanguage;
    if (!nextLanguage) {
      return;
    }

    this.selectedLanguage = nextLanguage;
    this.autoTranslationMessage = '';
    this.translateService.use(nextLanguage);
    this.ensureTranslationBucket(nextLanguage);
    this.loadTextsFromQtf(nextLanguage);

    if (this.selectedSection) {
      const translationKey = this.getSelectedTranslationKey();
      this.loadTextFromQtf(translationKey);
    }
  }

  loadTextsFromQtf(language: string) {
    if (!this.qtfFile || !language) {
      return;
    }

    console.log('Website load user language: ' + language);
    this.translateService.use(language);
    this.ensureTranslationBucket(language);

    let key: TextKey;
    for (key in this.qtfFile.TEXTS) {
      if (!Object.prototype.hasOwnProperty.call(this.qtfFile.TEXTS, key)) {
        continue;
      }
      const entry: QtfTextEntry = this.qtfFile.TEXTS[key];
      if (!entry) {
        continue;
      }
      const translation = entry.TRANSLATIONS[language] || entry.AUTOTRANSLATIONS?.[language] || '';
      this.translateService.set(key, translation, language);
    }
  }

  loadTextFromQtf(key: string | null) {
    if (!this.qtfFile || !key) {
      this.selectedTextContent = '';
      return;
    }

    // console.log("Loading from key: ", key);
    const entry = this.qtfFile.TEXTS[key];
    if (!entry) {
      this.selectedTextContent = '';
      this.ensureTranslationBucket(this.selectedLanguage);
      this.translateService.set(key, '', this.selectedLanguage);
      return;
    }
    this.ensureTranslationBucket(this.selectedLanguage);
    const translation = entry?.TRANSLATIONS?.[this.selectedLanguage] || entry?.AUTOTRANSLATIONS?.[this.selectedLanguage] || '';
    this.translateService.set(key, translation || '', this.selectedLanguage);
    this.selectedTextContent = translation;
  }

  saveCurrentSectionText() {
    if (!this.selectedSection || !this.qtfFile) { return; }

    const key = this.getSelectedTranslationKey();
    // console.log("saving: ", key, " - ", this.selectedTextContent);
    if (!key) { return; }

    this.isDirty = true;
    if (!this.qtfFile.TEXTS[key]) {
      this.qtfFile.TEXTS[key] = {
        group: 'HELP_INSTRUCTION',
        topic: 'HELPTEXT',
        comment: '',
        locked: false,
        obsolete: false,
        TRANSLATIONS: {},
        AUTOTRANSLATIONS: {},
        VERIFIED: {}
      };
    }
    if (!this.qtfFile.TEXTS[key].AUTOTRANSLATIONS) {
      this.qtfFile.TEXTS[key].AUTOTRANSLATIONS = {};
    }
    if (!this.qtfFile.TEXTS[key].VERIFIED) {
      this.qtfFile.TEXTS[key].VERIFIED = {};
    }
    if (this.qtfFile.TEXTS[key].TRANSLATIONS[this.selectedLanguage] !== this.selectedTextContent) {
      this.qtfFile.TEXTS[key].TRANSLATIONS[this.selectedLanguage] = this.selectedTextContent;
      this.ensureTranslationBucket(this.selectedLanguage);
      this.translateService.set(key, this.selectedTextContent, this.selectedLanguage);

      if (this.selectedLanguage === 'GERMAN') {
        this.languages.forEach(language => {
          if (language !== 'GERMAN') {
            this.qtfFile.TEXTS[key].TRANSLATIONS[language] = '';
            this.qtfFile.TEXTS[key].AUTOTRANSLATIONS[language] = undefined;
          }
        });
      }
    }
  }

  createNewMainsection() {
    if (!this.currentMainHelpSection) {
      return;
    }
    this.saveCurrentSectionText();

    const previousKey = this.getLastSiblingKey(this.currentMainHelpSection.content);
    const newKey = this.generateIdFromPrevious(previousKey) || ('NEW_SECTION_' + Math.random().toString(20).substring(2, 4));
    const newItem: HelpTextSection = this.currentMainHelpSection.addSection(newKey);
    console.log('created: ', newItem);

    if (this.qtfFile) {
      const translationKey = newItem.getTranslationKey();
      if (translationKey) {
        this.qtfFile.TEXTS[translationKey] = createNewQtfItem(this.selectedLanguage, 'new text');
      }
    }
    this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;
    this.onTopLevelChange(this.selectedTopLevelKey);
    const selectionId = getSectionSelectionId(newItem);
    if (selectionId) {
      this.onSelectSection(selectionId);
    }
  }

  createNewSubsection() {
    if (!this.currentMainHelpSection || !this.selectedSection) {
      return;
    }

    if (!this.canAddSubsectionForSection(this.selectedSection)) {
      console.warn('Cannot add subsections for content type: ', this.selectedSection.type);
      return;
    }
    this.saveCurrentSectionText();

    const createAsSibling = isInstructionContentType(this.selectedSection.type)
      || isEnumerationContentType(this.selectedSection.type);

    let targetParent: HelpTextSection = this.selectedSection;
    if (createAsSibling) {
      const selectedId = this.getSelectedSectionId();
      targetParent = selectedId ? this.currentMainHelpSection.findParentOfSectionById(selectedId) : null;
      if (!targetParent) {
        console.error('Parent not found for ', selectedId || this.selectedSection.type);
        return;
      }
    }

    const siblings = targetParent.subsections;
    const siblingIndex = siblings ? siblings.findIndex(section => section === this.selectedSection) : -1;
    const insertIndex = createAsSibling && siblingIndex >= 0 ? siblingIndex + 1 : (siblings?.length || 0);
    const previousKey = this.getPreviousSiblingKey(siblings, insertIndex);
    const newKey = this.generateIdFromPrevious(previousKey) || ('NEW_SECTION_' + Math.random().toString(20).substring(2, 4));

    const selectedId = this.getSelectedSectionId();
    const newItem: HelpTextSection = createAsSibling
      ? (selectedId ? targetParent.addSubsectionAfter(newKey, selectedId) : targetParent.addSubsection(newKey))
      : targetParent.addSubsection(newKey);
    console.log('created: ', newItem);

    if (this.qtfFile) {
      const translationKey = newItem.getTranslationKey();
      if (translationKey) {
        this.qtfFile.TEXTS[translationKey] = createNewQtfItem(this.selectedLanguage, 'new text');
      }
    }
    this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;
    this.onTopLevelChange(this.selectedTopLevelKey);
    const selectionId = getSectionSelectionId(newItem);
    if (selectionId) {
      this.onSelectSection(selectionId);
    }
  }

  createNewStep() {
    if (!this.currentMainHelpSection || !this.selectedSection) {
      return;
    }
    this.saveCurrentSectionText();

    console.log('Create step near by ', this.getSelectedSectionId());

    let parentSection: HelpTextSection = null;
    if (this.currentMainHelpSection && this.currentMainHelpSection !== null) {
      if (isEnumerationContentType(this.selectedSection.type)) {
        parentSection = this.selectedSection;
      } else {
        console.log('searching in HelpSection');
        const selectedId = this.getSelectedSectionId();
        parentSection = selectedId ? this.currentMainHelpSection.findParentOfSectionById(selectedId) : null;
      }

      if (!parentSection) {
        console.log('Parent not found for ', this.getSelectedSectionId() || this.selectedSection.type);
        return;
      }

      if (isEnumerationContentType(parentSection.type)) {
        const insertIndex = parentSection.steps ? parentSection.steps.length : 0;
        const previousKey = this.getPreviousSiblingKey(parentSection.steps, insertIndex);
        const parentKey = parentSection.value || parentSection.linkId || parentSection.type || 'ENUMERATION';
        const newStepId = this.generateIdFromPrevious(previousKey) || `${parentKey}_ENUM_123`;
        parentSection.addStep(newStepId);
        console.log('Step created ');
        this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;
        this.saveCurrentSectionText();
        this.onTopLevelChange(this.selectedTopLevelKey);
        this.onSelectSection(newStepId);
      } else {
        console.error('Parent is not an enumeration type. ', parentSection.value, ' Type: ', parentSection.type);
        return;
      }
    } else {
      console.log('No currentMainHelpSection');
    }
  }

  async deleteItem(sectionToDelete: HelpTextSection | HelpTextStep) {
    if (!sectionToDelete) {
      return;
    }

    const elementName = sectionToDelete.value || sectionToDelete.type || 'item';
    const confirmResult = await this.confirmDialog.openConfirmDialog(elementName);
    if (confirmResult !== 'yes') {
      return;
    }

    let parentSection: HelpTextSection = null;
    if (this.currentMainHelpSection && this.currentMainHelpSection !== null) {
      const deleteId = getSectionSelectionId(sectionToDelete as HelpTextSection | HelpTextStep);
      parentSection = deleteId ? this.currentMainHelpSection.findParentOfSectionById(deleteId) : null;
    }

    let removed = false;
    if (parentSection) {
      const deleteId = getSectionSelectionId(sectionToDelete as HelpTextSection | HelpTextStep);
      removed = deleteId ? parentSection.removeId(deleteId) : false;
    } else {
      removed = this.removeFromMainSection(sectionToDelete);
    }

    if (!removed) {
      console.error('Parent not found for ', sectionToDelete.value);
      return;
    }

    const currentSelectionId = this.getSelectedSectionId();
    const deletedId = getSectionSelectionId(sectionToDelete as HelpTextSection | HelpTextStep);
    const newSelectionId = (currentSelectionId && deletedId && currentSelectionId !== deletedId)
      ? currentSelectionId
      : getSectionSelectionId(parentSection);

    this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;
    this.saveCurrentSectionText();
    this.onTopLevelChange(this.selectedTopLevelKey);
    this.isDirty = true;

    if (newSelectionId) {
      this.onSelectSection(newSelectionId);
    }
  }

  private removeFromMainSection(sectionToDelete: HelpTextSection | HelpTextStep): boolean {
    if (!this.currentMainHelpSection || !sectionToDelete) {
      return false;
    }

    const removeFromCollection = (collection?: Array<HelpTextSection | HelpTextStep>) => {
      if (!collection) {
        return false;
      }
      const deleteId = getSectionSelectionId(sectionToDelete as HelpTextSection | HelpTextStep);
      const index = collection.findIndex(item => {
        const itemId = getSectionSelectionId(item as HelpTextSection | HelpTextStep);
        return !!deleteId && itemId === deleteId;
      });
      if (index !== -1) {
        collection.splice(index, 1);
        return true;
      }
      return false;
    };

    return removeFromCollection(this.currentMainHelpSection.content)
      || removeFromCollection(this.currentMainHelpSection.coversheet);
  }

  getImageLanguage(): String {
    if (this.selectedLanguage === 'ENGLISH') {
      return 'EN';
    } else if (this.selectedLanguage === 'GERMAN') {
      return 'DE';
    } else if (this.selectedLanguage === 'FRENCH') {
      return 'FR';
    }
    return 'EN';
  }

  onIdChanged(event) {
    const newId = event.target.value;
    // console.log("old id ", this.selectedSection.value, " - new id", newId);

    const currentKey = this.getSelectedTranslationKey();
    if (currentKey === newId) {
      return;
    }

    if (this.currentMainHelpSection.idExists(newId)) {
      alert('Id already exists.');
    }

    if (newId !== '') {
      const oldId = currentKey;
      if (oldId === null) {
        return;
      }
      const changed = this.updateSelectedTranslationKey(oldId, newId);
      if (changed) {
        console.log('Id changed. Old: ', oldId, ' -> ', newId, ': ', changed);
        this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;

        if (this.qtfFile && this.qtfFile.TEXTS) {
          const existingEntry = this.qtfFile.TEXTS[oldId];
          if (existingEntry) {
            this.qtfFile.TEXTS[newId] = {
              ...existingEntry,
              TRANSLATIONS: { ...existingEntry.TRANSLATIONS },
              AUTOTRANSLATIONS: { ...existingEntry.AUTOTRANSLATIONS },
              VERIFIED: { ...existingEntry.VERIFIED }
            };
            delete this.qtfFile.TEXTS[oldId];
          } else {
            this.qtfFile.TEXTS[newId] = createNewQtfItem(this.selectedLanguage, this.selectedTextContent);
          }

          const translatedText = this.qtfFile.TEXTS[newId].TRANSLATIONS[this.selectedLanguage] || '';
          this.translateService.set(newId, translatedText);
          this.selectedTextContent = translatedText;
        }

        this.saveCurrentSectionText();
        this.onTopLevelChange(this.selectedTopLevelKey);
        this.onSelectSection(newId);
      }
    }
  }

  private findTableCellContext(table: HelpTextTable, key: string): TableCellSelection | null {
    if (!table) {
      return null;
    }

    const tableId = getSectionSelectionId(table) || '';
    if (table.header) {
      for (let colIndex = 0; colIndex < table.header.length; colIndex += 1) {
        const cellKey = getTableCellKey(table.header[colIndex]);
        if (cellKey === key) {
          return { tableId, colIndex, isHeader: true, key };
        }
      }
    }

    if (table.rows) {
      for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
        const row = table.rows[rowIndex];
        if (!row?.rowValues) {
          continue;
        }
        for (let colIndex = 0; colIndex < row.rowValues.length; colIndex += 1) {
          const cellKey = getTableCellKey(row.rowValues[colIndex]);
          if (cellKey === key) {
            return { tableId, rowIndex, colIndex, isHeader: false, key };
          }
        }
      }
    }

    return null;
  }

  private getTableCellValue(table: HelpTextTable, selection: TableCellSelection): TableCellValue | null {
    if (!table || !selection) {
      return null;
    }

    if (selection.isHeader) {
      return table.header?.[selection.colIndex] ?? null;
    }

    const rowIndex = selection.rowIndex ?? -1;
    if (!table.rows || rowIndex < 0 || rowIndex >= table.rows.length) {
      return null;
    }

    return table.rows[rowIndex]?.rowValues?.[selection.colIndex] ?? null;
  }

  private setTableCellValue(table: HelpTextTable, selection: TableCellSelection, value: TableCellValue): boolean {
    if (!table || !selection) {
      return false;
    }

    if (selection.isHeader) {
      if (table.header && selection.colIndex >= 0 && selection.colIndex < table.header.length) {
        table.header[selection.colIndex] = value;
        return true;
      }
      return false;
    }

    const rowIndex = selection.rowIndex ?? -1;
    if (table.rows && rowIndex >= 0 && rowIndex < table.rows.length) {
      const row = table.rows[rowIndex];
      if (row?.rowValues && selection.colIndex >= 0 && selection.colIndex < row.rowValues.length) {
        row.rowValues[selection.colIndex] = value;
        return true;
      }
    }
    return false;
  }

  private syncSelectedTableCellKey(cellValue: TableCellValue | null): void {
    const key = getTableCellKey(cellValue);
    this.selectedContentKey = key;
    if (this.selectedTableCell) {
      this.selectedTableCell = { ...this.selectedTableCell, key };
    }
  }

  private getSelectedTableCellValue(): TableCellValue | null {
    if (!isTableSection(this.selectedSection) || !this.selectedTableCell) {
      return null;
    }
    return this.getTableCellValue(this.selectedSection as HelpTextTable, this.selectedTableCell);
  }

  private updateSelectedTableCellValue(value: TableCellValue): void {
    if (!isTableSection(this.selectedSection) || !this.selectedTableCell) {
      return;
    }

    const table = this.selectedSection as HelpTextTable;
    const changed = this.setTableCellValue(table, this.selectedTableCell, value);
    if (!changed) {
      return;
    }

    this.syncSelectedTableCellKey(value);
    this.isDirty = true;
    this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;
    this.loadTextFromQtf(this.selectedContentKey);
  }

  private updateSelectedTranslationKey(oldId: string, newId: string): boolean {
    if (!this.currentMainHelpSection) {
      return false;
    }

    if (isTableSection(this.selectedSection) && this.selectedTableCell) {
      const table = this.selectedSection as HelpTextTable;
      if (this.selectedTableCell.isHeader) {
        if (table.header && this.selectedTableCell.colIndex < table.header.length) {
          const existingCell = table.header[this.selectedTableCell.colIndex];
          if (isTableCellImage(existingCell)) {
            table.header[this.selectedTableCell.colIndex] = {
              ...existingCell,
              imageDescription: newId
            };
          } else {
            table.header[this.selectedTableCell.colIndex] = newId;
          }
          this.selectedContentKey = newId;
          this.selectedTableCell = { ...this.selectedTableCell, key: newId };
          return true;
        }
        return false;
      }

      const rowIndex = this.selectedTableCell.rowIndex ?? -1;
      if (table.rows && rowIndex >= 0 && rowIndex < table.rows.length) {
        const row = table.rows[rowIndex];
        if (row?.rowValues && this.selectedTableCell.colIndex < row.rowValues.length) {
          const existingCell = row.rowValues[this.selectedTableCell.colIndex];
          if (isTableCellImage(existingCell)) {
            row.rowValues[this.selectedTableCell.colIndex] = {
              ...existingCell,
              imageDescription: newId
            };
          } else {
            row.rowValues[this.selectedTableCell.colIndex] = newId;
          }
          this.selectedContentKey = newId;
          this.selectedTableCell = { ...this.selectedTableCell, key: newId };
          return true;
        }
      }
      return false;
    }

    return this.currentMainHelpSection.changeValueId(oldId, newId);
  }

  onLinkChanged(event) {
    const newLink = event.target.value;

    if ((this.selectedSection.linkId !== newLink) && (newLink !== '')) {
      console.log('onLinkChanged');
      const currentValue = this.getSelectedSectionId();

      this.selectedSection.linkId = newLink;
      console.log('New link id: ', newLink, ' for section: ', this.selectedSection.value);
      this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;
      this.saveCurrentSectionText();
      this.onTopLevelChange(this.selectedTopLevelKey);
      if (currentValue) {
        this.onSelectSection(currentValue);
      }
    }
  }

  onTranslationChanged(newText: string) {
    this.selectedTextContent = newText;
    this.autoTranslationMessage = '';
    this.saveCurrentSectionText();
  }

  canAutoTranslateCurrentSelection(): boolean {
    if (!this.selectedSection || !this.qtfFile) {
      return false;
    }

    const key = this.getSelectedTranslationKey();
    const entry = this.getTranslationEntryForSelection(key);
    const hasToken = this.getActiveDeeplToken();
    const targetLanguage = this.deeplTranslationService.mapLanguageToDeepL(this.selectedLanguage);
    const sourceTranslation = this.getSourceTranslation(entry);

    return !!(entry && !this.hasExistingTranslation(entry) && hasToken && targetLanguage && sourceTranslation);
  }

  autoTranslateCurrentSelection() {
    if (!this.selectedSection || !this.qtfFile) {
      return;
    }

    const key = this.getSelectedTranslationKey();
    if (!key) {
      this.autoTranslationMessage = 'Kein zu übersetzender Schlüssel gefunden.';
      return;
    }
    const entry = this.getTranslationEntryForSelection(key);
    if (!entry) {
      this.autoTranslationMessage = 'Keine zugehörige Übersetzung gefunden.';
      return;
    }

    const token = this.getActiveDeeplToken();
    if (!token) {
      this.autoTranslationMessage = 'Automatische Übersetzung ist derzeit nicht verfügbar.';
      return;
    }

    const targetLanguage = this.deeplTranslationService.mapLanguageToDeepL(this.selectedLanguage);
    if (!targetLanguage) {
      this.autoTranslationMessage = 'Die ausgewählte Zielsprache wird von DeepL nicht unterstützt.';
      return;
    }

    const sourceTranslation = this.getSourceTranslation(entry);
    if (!sourceTranslation) {
      this.autoTranslationMessage = 'Keine Ausgangssprache für die Übersetzung gefunden.';
      return;
    }

    this.isAutoTranslating = true;
    this.autoTranslationMessage = 'Übersetzung wird angefragt...';

    this.deeplTranslationService.translateText(
      sourceTranslation.text,
      sourceTranslation.languageCode,
      targetLanguage,
      token
    ).subscribe({
      next: translatedText => {
        entry.TRANSLATIONS[this.selectedLanguage] = translatedText;
        entry.AUTOTRANSLATIONS[this.selectedLanguage] = translatedText;
        this.translateService.set(key, translatedText);
        this.selectedTextContent = translatedText;
        this.isDirty = true;
        this.autoTranslationMessage = 'Automatische Übersetzung gespeichert.';
      },
      error: (error) => {
        console.error('DeepL translation failed', error);
        const deeplErrorMessage = error?.error?.message || error?.message || '';
        const deeplDetails = error?.error?.details;
        const deeplMessageSuffix = deeplDetails
          ? `${deeplErrorMessage ? `${deeplErrorMessage} (${deeplDetails})` : deeplDetails}`
          : deeplErrorMessage;
        this.autoTranslationMessage = deeplMessageSuffix
          ? `Automatische Übersetzung fehlgeschlagen. DeepL-Fehler: ${deeplMessageSuffix}`
          : 'Automatische Übersetzung fehlgeschlagen.';
        this.isAutoTranslating = false;
      },
      complete: () => this.isAutoTranslating = false
    });
  }

  onImageFileChanged(event) {
    const newImageFile = event.target.value;
    // console.log("Image to change: ", this.selectedSection.value, " new: ", newImageFile);
    if (newImageFile !== '' && this.selectedSection.value !== newImageFile) {
      const changed = this.currentMainHelpSection.changeValueId(this.selectedSection.value, newImageFile);
      console.log('Image changed: ', changed, ' new: ', newImageFile);
      if (changed) {
        this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;
        this.saveCurrentSectionText();
        this.onTopLevelChange(this.selectedTopLevelKey);
        this.onSelectSection(newImageFile);
      }
    } else {

    }
  }

  onTopLevelChange(key: string) {
    this.selectedTopLevelKey = key;
    this.currentMainHelpSection = parseMainHelpSection(this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey]);
    // console.log("Top key: ", this.selectedTopLevelKey, typeof (this.currentMainHelpSection));
    // console.log("item class: ", this.currentMainHelpSection.constructor.name);
    // console.log(this.currentMainHelpSection instanceof MainHelpSection);
    // console.log(this.currentMainHelpSection);
    this.selectedSection = undefined;
    this.selectedContentKey = null;
    this.selectedTableCell = null;
    this.selectedTextContent = '';
  }

  openOverlayFileOpen() {
    this.showOverlayFileOpen = true;
  }

  openOverlayAddContent() {
    if (this.selectedSection && !this.canAddContentToSection(this.selectedSection)) {
      console.warn('Cannot add content for content type: ', this.selectedSection.type);
      return;
    }
    this.showOverlayAddContent = true;
  }

  closeOverlayFileOpen(data: { cancelled: boolean; files?: { jsonData: any; qtfData: any } }) {
    // Overlay ausblenden
    this.showOverlayFileOpen = false;

    if (!data.cancelled && data.files) {
      this.helpTextRoot = parseHelpTextRoot(data.files.jsonData);
      const keys = this.getRootKeys();
      if (keys.length > 0) {
        // We must immediately parse and select the first key; otherwise currentMainHelpSection stays null
        // and drag/drop handlers end up with undefined access.
        this.onTopLevelChange(keys[0]);
      }
      this.qtfFile = data.files.qtfData;

      this.loadTextsFromQtf(this.selectedLanguage);
    } else {
      console.log('Upload abgebrochen');
    }
  }

  closeOverlayAddContent(data: { cancelled: boolean; type?: HelpContentType; insertPosition?: string }) {
    this.showOverlayAddContent = false;
    console.log('Cancelled ', data.cancelled, ' type: ', data.type, ' pos: ', data.insertPosition);

    if (!data || data.cancelled || !data.type || !data.insertPosition) {
      return;
    }

    this.saveCurrentSectionText(); // Änderungen des aktuellen Editors sichern

    console.log('Creating new for parent: ', this.getSelectedSectionId());

    let parentSection: HelpTextSection = null;

    if (!this.selectedSection.type) {
      parentSection = this.selectedSection;
    } else if (this.currentMainHelpSection) {
      const selectedId = this.getSelectedSectionId();
      parentSection = selectedId ? this.currentMainHelpSection.findParentOfSectionById(selectedId) : null;
    }

    if (!parentSection) {
      console.log('Parent not found for ', this.getSelectedSectionId() || this.selectedSection.type);
      return;
    }

    const insertIndex = this.getInsertIndex(parentSection, data.insertPosition);
    const previousKey = this.getPreviousSiblingKey(parentSection.content, insertIndex);
    const parentKey = parentSection.value || parentSection.linkId || parentSection.type || 'SECTION';
    const newKey = this.generateIdFromPrevious(previousKey)
      || `${parentKey}_${data.type}_${Math.random().toString(36).substring(2)}`;
    const newLinkId = 'LINK_' + Math.random().toString(36).substring(2);
    const newItem: HelpTextSection = data.type === HelpContentType.TABLE
      ? this.createTableSection()
      : new HelpTextSection();
    newItem.linkId = newLinkId;
    newItem.value = newKey;
    newItem.linkId = '';
    newItem.type = data.type;

    if (isImageContentType(data.type)) {
      newItem.value = 'empty';
      newItem.imageDescription = newKey;
      newItem.border = false;
    }

    if (isValuelessContentType(data.type)) {
      newItem.value = undefined;
    }

    if (isImageContentType(newItem.type)) {
      newItem.id = newItem.imageDescription || newItem.value || newItem.id;
    } else if (newItem.value && !isValuelessContentType(newItem.type)) {
      newItem.id = newItem.value;
    }

    console.log('parent ', parentSection.constructor.name, ' value: ', parentSection.value);
    if (!parentSection.content) {
      parentSection.content = [];
    }

    parentSection.content.splice(insertIndex, 0, newItem);

    // Neuen Eintrag in der QTF-Struktur anlegen
    if (this.qtfFile) {
      const translationKey = newItem.getTranslationKey();
      if (translationKey) {
        this.qtfFile.TEXTS[translationKey] = createNewQtfItem(this.selectedLanguage, 'new text');
      }
    }

    if (isEnumerationContentType(data.type)) {
      newItem.addStep('New step');
    }

    this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;
    this.saveCurrentSectionText();
    this.onTopLevelChange(this.selectedTopLevelKey);
    const selectionId = getSectionSelectionId(newItem);
    if (selectionId) {
      this.onSelectSection(selectionId);
    }
  }

  openImagePicker(): void {
    // Beispiel: Wir übergeben einen initialen Dateinamen
    const initialFilename = 'logo.png';

    this.actionsService.openImagePickerDialog(initialFilename)
      .subscribe((result) => {
        // result ist der Dateiname oder null, wenn abgebrochen
        if (result) {
          this.selectedSection.value = result;
          console.log('Bild ausgewählt:', result);
        } else {
          console.log('Dialog ohne Auswahl geschlossen.');
        }
      });
  }

  async cleanQtf() {
    if (!this.qtfFile) {
      return;
    }

    const unusedKeys = this.getUnusedQtfKeys();

    const result = await this.actionsService.openCleanQtfDialog({
      unusedKeys,
      qtfFile: this.qtfFile
    }).pipe(take(1)).toPromise();
    if (!result || !result.deletedKeys || result.deletedKeys.length === 0) {
      return;
    }

    result.deletedKeys.forEach(key => {
      if (this.qtfFile && key in this.qtfFile.TEXTS) {
        this.qtfFile = removeQtfItem(this.qtfFile, key as TextKey);
      }
    });

    this.isDirty = true;
  }

  openTranslationIssuesDialog(): void {
    this.actionsService.openTranslationIssuesDialog({
      helpTextRoot: this.helpTextRoot,
      qtfFile: this.qtfFile,
      selectedLanguage: this.selectedLanguage,
      deeplToken: this.getActiveDeeplToken()
    }).subscribe((result) => {
      if (!result) {
        return;
      }
      if (result.qtfFile) {
        this.qtfFile = result.qtfFile;
      }
      if (result.isDirty) {
        this.isDirty = true;
      }
    });
  }

  openDeeplSettingsDialog(): void {
    this.actionsService.openDeeplSettingsDialog({
      token: this.getActiveDeeplToken(),
      rememberToken: !!this.deeplTranslationService.getStoredAuthKey()
    }).subscribe((result) => {
      if (!result) {
        return;
      }

      if (result.clearToken) {
        this.deeplTranslationService.storeAuthKey('');
        this.deeplAuthKey = '';
        this.autoTranslationMessage = 'DeepL-Einstellungen wurden zurückgesetzt.';
        return;
      }

      this.deeplAuthKey = result.token || '';
      this.autoTranslationMessage = this.deeplAuthKey
        ? 'DeepL-Einstellungen aktualisiert.'
        : 'DeepL-Einstellungen sind nicht gesetzt.';

      if (result.rememberToken && this.deeplAuthKey) {
        this.deeplTranslationService.storeAuthKey(this.deeplAuthKey);
      } else {
        this.deeplTranslationService.storeAuthKey('');
      }
    });
  }

  private getActiveDeeplToken(): string {
    return (this.deeplAuthKey || this.deeplTranslationService.getStoredAuthKey() || '').trim();
  }

  private getInsertIndex(parentSection: HelpTextSection, insertPosition: string): number {
    if (!parentSection || !parentSection.content || parentSection.content.length === 0) {
      return 0;
    }

    const selectedIndex = parentSection.content.findIndex(item => item === this.selectedSection);
    if (insertPosition === 'after' && selectedIndex >= 0) {
      return Math.min(selectedIndex + 1, parentSection.content.length);
    }

    return parentSection.content.length;
  }

  private getPreviousSiblingKey(collection: Array<HelpTextSection | HelpTextStep> | undefined, insertIndex: number): string | null {
    if (!collection || collection.length === 0 || insertIndex <= 0) {
      return null;
    }

    const safeIndex = Math.min(insertIndex, collection.length) - 1;
    return this.getItemTranslationKey(collection[safeIndex]);
  }

  private getLastSiblingKey(collection: Array<HelpTextSection | HelpTextStep> | undefined): string | null {
    if (!collection || collection.length === 0) {
      return null;
    }

    return this.getItemTranslationKey(collection[collection.length - 1]);
  }

  private getItemTranslationKey(item: HelpTextSection | HelpTextStep | undefined): string | null {
    if (!item) { return null; }

    const getter = (item as any).getTranslationKey;
    if (typeof getter === 'function') {
      const key = getter.call(item);
      return key || null;
    }

    return (item as any).value || null;
  }

  private generateIdFromPrevious(previousKey: string | null): string | null {
    if (!previousKey) {
      return null;
    }

    const match = previousKey.match(/^(.*?)(\\d+)$/);
    if (!match) {
      return null;
    }

    const prefix = match[1];
    let counter = parseInt(match[2], 10);
    if (isNaN(counter)) {
      return null;
    }

    let candidate: string;
    do {
      counter += 1;
      candidate = `${prefix}${counter}`;
    } while (this.helpTextRootIdExists(candidate));

    return candidate;
  }

  private helpTextRootIdExists(key: string): boolean {
    const root = this.ensureParsedHelpTextRoot();
    return !!(root && typeof root.idExists === 'function' && root.idExists(key));
  }

  private ensureCurrentMainSection(): MainHelpSection | null {
    if (this.currentMainHelpSection) {
      return this.currentMainHelpSection;
    }
    if (this.helpTextRoot && this.selectedTopLevelKey) {
      const parsed = parseMainHelpSection(this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey]);
      this.currentMainHelpSection = parsed;
      if (parsed) {
        this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = parsed;
      }
    }
    return this.currentMainHelpSection;
  }

  private getUnusedQtfKeys(): string[] {
    if (!this.qtfFile || !this.qtfFile.TEXTS) {
      return [];
    }

    return Object.keys(this.qtfFile.TEXTS).filter(key =>
      !this.keywordInList(key) && !this.helpTextRootIdExists(key)
    );
  }

  private ensureParsedHelpTextRoot(): HelpTextRoot | null {
    if (!this.helpTextRoot) {
      return null;
    }

    if (typeof (this.helpTextRoot as any).idExists === 'function') {
      return this.helpTextRoot;
    }

    this.helpTextRoot = parseHelpTextRoot(this.helpTextRoot as any);
    return this.helpTextRoot;
  }

  keywordInList(keyword: string): boolean {
    const escape = (s: string) =>
      s.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
    const pattern = this.allowedKeys.map(escape).join('|');
    const re = new RegExp(`^(?:${pattern})$|${pattern}`);
    return re.test(keyword);
  }

  private getAllAbbreviations(): AbbreviationItem[] {
    const items: AbbreviationItem[] = [];
    const root = this.ensureParsedHelpTextRoot();
    if (!root) { return items; }

    Object.values(root).forEach(value => {
      const section = value as MainHelpSection;
      section?.abbreviations?.forEach(abbr => items.push(abbr));
    });

    return items;
  }

  private ensureAbbreviationQtfEntries(abbreviation: AbbreviationItem, previous: AbbreviationItem | null): void {
    if (!this.qtfFile) { return; }
    if (!this.qtfFile.TEXTS) {
      this.qtfFile.TEXTS = {};
    }

    const newKeys = [abbreviation.shortDescription, abbreviation.longDescription].filter(Boolean) as string[];
    const previousKeys = previous ? [previous.shortDescription, previous.longDescription] : [];

    newKeys.forEach((key, idx) => {
      if (!key) { return; }
      if (!this.qtfFile.TEXTS[key]) {
        const previousKey = previousKeys[idx];
        if (previousKey && this.qtfFile.TEXTS[previousKey]) {
          const previousEntry = this.qtfFile.TEXTS[previousKey];
          this.qtfFile.TEXTS[key] = {
            ...previousEntry,
            TRANSLATIONS: { ...previousEntry.TRANSLATIONS },
            AUTOTRANSLATIONS: { ...previousEntry.AUTOTRANSLATIONS },
            VERIFIED: { ...previousEntry.VERIFIED }
          };
        } else {
          this.qtfFile.TEXTS[key] = createNewQtfItem(this.selectedLanguage, '');
        }
      }
    });
  }

  private ensureQtfEntry(key: string, previousKey?: string): void {
    if (!this.qtfFile) {
      return;
    }
    if (!this.qtfFile.TEXTS) {
      this.qtfFile.TEXTS = {};
    }
    if (!this.qtfFile.TEXTS[key]) {
      if (previousKey && this.qtfFile.TEXTS[previousKey]) {
        const previousEntry = this.qtfFile.TEXTS[previousKey];
        this.qtfFile.TEXTS[key] = {
          ...previousEntry,
          TRANSLATIONS: { ...previousEntry.TRANSLATIONS },
          AUTOTRANSLATIONS: { ...previousEntry.AUTOTRANSLATIONS },
          VERIFIED: { ...previousEntry.VERIFIED }
        };
      } else {
        this.qtfFile.TEXTS[key] = createNewQtfItem(this.selectedLanguage, '');
      }
    }
  }

  private persistAbbreviationChange(mainSection: MainHelpSection): void {
    const selectedId = this.getSelectedSectionId();
    this.currentMainHelpSection = mainSection;
    if (this.selectedTopLevelKey) {
      this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;
    }
    this.isDirty = true;
    this.saveCurrentSectionText();
    if (this.selectedTopLevelKey) {
      this.onTopLevelChange(this.selectedTopLevelKey);
      if (selectedId) {
        this.onSelectSection(selectedId);
      }
    }
  }

  public getSelectedTranslationKey(): string | null {
    if (!this.selectedSection) {
      return null;
    }
    if (this.selectedContentKey !== null && this.selectedContentKey !== undefined) {
      return this.selectedContentKey;
    }
    const getter = (this.selectedSection as any).getTranslationKey;
    if (typeof getter === 'function') {
      const key = getter.call(this.selectedSection);
      return key || null;
    }
    return this.selectedSection.value || null;
  }

  public getSelectedSectionId(): string | null {
    return getSectionSelectionId(this.selectedSection as HelpTextSection | HelpTextStep);
  }

  public get translationIdCount(): number {
    if (!this.qtfFile?.TEXTS) {
      return 0;
    }

    return Object.values(this.qtfFile.TEXTS).filter(entry => this.hasExistingTranslation(entry)).length;
  }

  canEditTranslationForSelection(): boolean {
    const key = this.getSelectedTranslationKey();
    return key !== null && key !== undefined;
  }

  showIdNameProperty(): boolean {
    if (!this.selectedSection) {
      return false;
    }

    return !(isTableSection(this.selectedSection) && this.selectedTableCell);
  }

  public isTableSection(section?: HelpTextSection | null): section is HelpTextTable {
    return isTableSection(section);
  }

  public isImageSection(section?: HelpTextSection | null): boolean {
    return !!section && isImageContentType(section.type);
  }

  private createTableSection(): HelpTextTable {
    const table = new HelpTextTable();
    table.type = HelpContentType.TABLE;
    table.header = [];
    table.rows = [];

    const columnCount = 2;
    const rowCount = 2;

    for (let colIndex = 0; colIndex < columnCount; colIndex += 1) {
      const headerKey = this.createUniqueTableCellKey('TABLE_HEADER');
      table.header.push(headerKey);
      this.ensureQtfEntry(headerKey);
    }

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const rowValues: TableCellValue[] = [];
      for (let colIndex = 0; colIndex < columnCount; colIndex += 1) {
        const cellKey = this.createUniqueTableCellKey('TABLE_CELL');
        rowValues.push(cellKey);
        this.ensureQtfEntry(cellKey);
      }
      table.rows.push({ rowValues });
    }

    return table;
  }

  public addTableRow(): void {
    if (!isTableSection(this.selectedSection)) {
      return;
    }

    this.saveCurrentSectionText();
    const table = this.selectedSection as HelpTextTable;
    if (!table.rows) {
      table.rows = [];
    }

    const insertIndex = this.getTableRowInsertIndex(table);
    const columnCount = Math.max(1, this.getTableColumnCount(table));
    const rowValues: TableCellValue[] = [];

    for (let colIndex = 0; colIndex < columnCount; colIndex += 1) {
      const newKey = this.createUniqueTableCellKey('TABLE_CELL');
      rowValues.push(newKey);
      this.ensureQtfEntry(newKey);
    }

    table.rows.splice(insertIndex, 0, { rowValues });
    this.isDirty = true;
    this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;

    const tableId = getSectionSelectionId(table) || '';
    this.onSelectSection({
      tableId,
      rowIndex: insertIndex,
      colIndex: 0,
      isHeader: false,
      key: getTableCellKey(rowValues[0])
    });
  }

  public canMoveTableRow(direction: 'up' | 'down'): boolean {
    if (!isTableSection(this.selectedSection) || !this.selectedTableCell || this.selectedTableCell.isHeader) {
      return false;
    }

    const table = this.selectedSection as HelpTextTable;
    const rowIndex = this.selectedTableCell.rowIndex ?? -1;
    if (!table.rows || rowIndex < 0 || rowIndex >= table.rows.length) {
      return false;
    }

    return direction === 'up' ? rowIndex > 0 : rowIndex < table.rows.length - 1;
  }

  public moveTableRow(direction: 'up' | 'down'): void {
    if (!this.canMoveTableRow(direction)) {
      return;
    }

    this.saveCurrentSectionText();
    const table = this.selectedSection as HelpTextTable;
    const rowIndex = this.selectedTableCell?.rowIndex ?? -1;
    if (!table.rows || rowIndex < 0 || rowIndex >= table.rows.length) {
      return;
    }

    const targetIndex = direction === 'up' ? rowIndex - 1 : rowIndex + 1;
    const [row] = table.rows.splice(rowIndex, 1);
    table.rows.splice(targetIndex, 0, row);

    this.isDirty = true;
    this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;

    const tableId = getSectionSelectionId(table) || '';
    if (!tableId) {
      return;
    }

    const selectedColIndex = this.selectedTableCell?.colIndex ?? 0;
    const maxColIndex = (row.rowValues?.length ?? 1) - 1;
    const nextColIndex = Math.min(Math.max(selectedColIndex, 0), Math.max(maxColIndex, 0));
    const nextCellValue = row.rowValues?.[nextColIndex] ?? null;
    this.onSelectSection({
      tableId,
      rowIndex: targetIndex,
      colIndex: nextColIndex,
      isHeader: false,
      key: getTableCellKey(nextCellValue)
    });
  }

  public addTableColumn(): void {
    if (!isTableSection(this.selectedSection)) {
      return;
    }

    this.saveCurrentSectionText();
    const table = this.selectedSection as HelpTextTable;
    if (!table.header) {
      table.header = [];
    }

    const insertIndex = this.getTableColumnInsertIndex(table);
    const headerKey = this.createUniqueTableCellKey('TABLE_HEADER');
    table.header.splice(insertIndex, 0, headerKey);
    this.ensureQtfEntry(headerKey);

    if (table.rows) {
      for (const row of table.rows) {
        if (!row.rowValues) {
          row.rowValues = [];
        }
        const rowKey = this.createUniqueTableCellKey('TABLE_CELL');
        row.rowValues.splice(insertIndex, 0, rowKey);
        this.ensureQtfEntry(rowKey);
      }
    }

    this.isDirty = true;
    this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;

    const tableId = getSectionSelectionId(table) || '';
    this.onSelectSection({
      tableId,
      colIndex: insertIndex,
      isHeader: true,
      key: getTableCellKey(headerKey)
    });
  }

  public removeTableColumn(): void {
    if (!isTableSection(this.selectedSection)) {
      return;
    }

    const table = this.selectedSection as HelpTextTable;
    const columnCount = this.getTableColumnCount(table);
    if (columnCount <= 1) {
      return;
    }

    const removeIndex = this.selectedTableCell ? (this.selectedTableCell.colIndex ?? -1) : columnCount - 1;
    if (removeIndex < 0 || removeIndex >= columnCount) {
      return;
    }

    this.saveCurrentSectionText();

    if (table.header && removeIndex < table.header.length) {
      table.header.splice(removeIndex, 1);
    }

    if (table.rows) {
      for (const row of table.rows) {
        if (row.rowValues && removeIndex < row.rowValues.length) {
          row.rowValues.splice(removeIndex, 1);
        }
      }
    }

    this.isDirty = true;
    this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;

    const tableId = getSectionSelectionId(table) || '';
    if (!tableId) {
      return;
    }

    const nextColIndex = Math.min(removeIndex, columnCount - 2);
    if (this.selectedTableCell) {
      if (this.selectedTableCell.isHeader) {
        const nextHeaderKey = table.header?.[nextColIndex] ?? null;
        this.onSelectSection({
          tableId,
          colIndex: nextColIndex,
          isHeader: true,
          key: getTableCellKey(nextHeaderKey)
        });
        return;
      }

      const rowIndex = this.selectedTableCell.rowIndex ?? -1;
      if (table.rows && rowIndex >= 0 && rowIndex < table.rows.length) {
        const rowValues = table.rows[rowIndex]?.rowValues ?? [];
        const nextCell = rowValues[nextColIndex] ?? null;
        this.onSelectSection({
          tableId,
          colIndex: nextColIndex,
          rowIndex,
          isHeader: false,
          key: getTableCellKey(nextCell)
        });
        return;
      }
    }

    const fallbackHeaderKey = table.header?.[nextColIndex] ?? null;
    this.onSelectSection({
      tableId,
      colIndex: nextColIndex,
      isHeader: true,
      key: getTableCellKey(fallbackHeaderKey)
    });
  }

  private getTableColumnCount(table: HelpTextTable): number {
    let columnCount = table.header?.length ?? 0;
    if (table.rows) {
      for (const row of table.rows) {
        columnCount = Math.max(columnCount, row.rowValues?.length ?? 0);
      }
    }
    return columnCount;
  }

  private getTableRowInsertIndex(table: HelpTextTable): number {
    if (this.selectedTableCell && !this.selectedTableCell.isHeader) {
      const rowIndex = this.selectedTableCell.rowIndex ?? -1;
      if (rowIndex >= 0 && table.rows && rowIndex < table.rows.length) {
        return rowIndex + 1;
      }
    }
    return table.rows?.length ?? 0;
  }

  private getTableColumnInsertIndex(table: HelpTextTable): number {
    if (this.selectedTableCell) {
      const colIndex = this.selectedTableCell.colIndex ?? -1;
      const columnCount = this.getTableColumnCount(table);
      if (colIndex >= 0 && colIndex < columnCount) {
        return colIndex + 1;
      }
    }
    const headerLength = table.header?.length ?? 0;
    return headerLength > 0 ? headerLength : this.getTableColumnCount(table);
  }

  private createUniqueTableCellKey(prefix: string): string {
    let counter = 1;
    let candidate = `${prefix}_${counter}`;
    while (this.helpTextRootIdExists(candidate)) {
      counter += 1;
      candidate = `${prefix}_${counter}`;
    }
    return candidate;
  }

  public getSelectedTableCellType(): 'TEXT' | 'IMAGE' {
    const cellValue = this.getSelectedTableCellValue();
    return isTableCellImage(cellValue) ? 'IMAGE' : 'TEXT';
  }

  public onTableCellTypeChanged(type: 'TEXT' | 'IMAGE'): void {
    if (!isTableSection(this.selectedSection) || !this.selectedTableCell) {
      return;
    }

    const currentValue = this.getSelectedTableCellValue();
    if (type === 'IMAGE') {
      const description = typeof currentValue === 'string'
        ? currentValue
        : isTableCellImage(currentValue)
          ? currentValue.imageDescription
          : undefined;
      const nextValue: TableCellImage = {
        type: HelpContentType.IMAGE,
        value: isTableCellImage(currentValue) ? currentValue.value : '',
        imageDescription: description,
        width: isTableCellImage(currentValue) ? currentValue.width : undefined,
        height: isTableCellImage(currentValue) ? currentValue.height : undefined,
        border: isTableCellImage(currentValue) ? currentValue.border : undefined
      };
      this.updateSelectedTableCellValue(nextValue);
      return;
    }

    const nextKey = isTableCellImage(currentValue)
      ? (currentValue.imageDescription || '')
      : (typeof currentValue === 'string' ? currentValue : '');
    this.updateSelectedTableCellValue(nextKey);
  }

  public getSelectedTableCellImageValue(): string {
    const cellValue = this.getSelectedTableCellValue();
    return isTableCellImage(cellValue) ? cellValue.value : '';
  }

  public getSelectedTableCellImageDescription(): string {
    const cellValue = this.getSelectedTableCellValue();
    return isTableCellImage(cellValue) ? (cellValue.imageDescription || '') : '';
  }

  public getSelectedTableCellImageWidth(): string {
    const cellValue = this.getSelectedTableCellValue();
    return isTableCellImage(cellValue) ? (cellValue.width || '') : '';
  }

  public getSelectedTableCellImageHeight(): string {
    const cellValue = this.getSelectedTableCellValue();
    return isTableCellImage(cellValue) ? (cellValue.height || '') : '';
  }

  public getSelectedTableCellImageBorder(): boolean {
    const cellValue = this.getSelectedTableCellValue();
    return isTableCellImage(cellValue) ? !!cellValue.border : false;
  }

  public onTableCellImageFileChanged(event): void {
    if (!isTableSection(this.selectedSection) || !this.selectedTableCell) {
      return;
    }
    const newValue = event.target.value;
    const currentValue = this.getSelectedTableCellValue();
    const nextValue: TableCellImage = isTableCellImage(currentValue)
      ? { ...currentValue, value: newValue }
      : {
        type: HelpContentType.IMAGE,
        value: newValue,
        imageDescription: typeof currentValue === 'string' ? currentValue : undefined
      };
    this.updateSelectedTableCellValue(nextValue);
  }

  public onTableCellImageDescriptionChanged(event): void {
    if (!isTableSection(this.selectedSection) || !this.selectedTableCell) {
      return;
    }
    const newDescription = event.target.value;
    const currentValue = this.getSelectedTableCellValue();
    const currentKey = this.getSelectedTranslationKey();

    if (currentKey && newDescription && currentKey !== newDescription) {
      this.onIdChanged(event);
      return;
    }

    if (!isTableCellImage(currentValue)) {
      return;
    }

    if (!currentKey && newDescription && this.currentMainHelpSection.idExists(newDescription)) {
      alert('Id already exists.');
      return;
    }

    const nextValue: TableCellImage = {
      ...currentValue,
      imageDescription: newDescription || undefined
    };
    this.updateSelectedTableCellValue(nextValue);

    if (newDescription) {
      this.ensureQtfEntry(newDescription);
      this.loadTextFromQtf(newDescription);
    } else {
      this.selectedTextContent = '';
    }
  }

  public onTableCellImageWidthChanged(event): void {
    if (!isTableSection(this.selectedSection) || !this.selectedTableCell) {
      return;
    }
    const newWidth = event.target.value;
    const currentValue = this.getSelectedTableCellValue();
    if (!isTableCellImage(currentValue)) {
      return;
    }
    this.updateSelectedTableCellValue({ ...currentValue, width: newWidth || undefined });
  }

  public onTableCellImageHeightChanged(event): void {
    if (!isTableSection(this.selectedSection) || !this.selectedTableCell) {
      return;
    }
    const newHeight = event.target.value;
    const currentValue = this.getSelectedTableCellValue();
    if (!isTableCellImage(currentValue)) {
      return;
    }
    this.updateSelectedTableCellValue({ ...currentValue, height: newHeight || undefined });
  }

  public onTableCellImageBorderChanged(event): void {
    if (!isTableSection(this.selectedSection) || !this.selectedTableCell) {
      return;
    }
    const checked = !!event.target.checked;
    const currentValue = this.getSelectedTableCellValue();
    if (!isTableCellImage(currentValue)) {
      return;
    }
    this.updateSelectedTableCellValue({ ...currentValue, border: checked });
  }

  private getTranslationEntryForSelection(key: string | null): QtfTextEntry | null {
    if (!key || !this.qtfFile || !this.qtfFile.TEXTS) {
      return null;
    }

    return this.qtfFile.TEXTS[key] || null;
  }

  private hasExistingTranslation(entry: QtfTextEntry | null): boolean {
    if (!entry) {
      return false;
    }

    const translation = entry.TRANSLATIONS?.[this.selectedLanguage];
    const autoTranslation = entry.AUTOTRANSLATIONS?.[this.selectedLanguage];
    return !!(translation || autoTranslation);
  }

  hasMissingTranslationForSelection(): boolean {
    const key = this.getSelectedTranslationKey();
    const entry = this.getTranslationEntryForSelection(key);
    return !!(entry && !this.hasExistingTranslation(entry));
  }

  private getSourceTranslation(entry: QtfTextEntry | null): { text: string; languageCode?: string } | null {
    if (!entry) {
      return null;
    }

    const preferredSources = ['GERMAN', 'ENGLISH'];
    for (const lang of preferredSources) {
      const text = entry.TRANSLATIONS?.[lang] || entry.AUTOTRANSLATIONS?.[lang];
      if (text && lang !== this.selectedLanguage) {
        return { text, languageCode: this.deeplTranslationService.mapLanguageToDeepL(lang) };
      }
    }

    const combinedTranslations = { ...entry.TRANSLATIONS, ...entry.AUTOTRANSLATIONS };
    for (const [lang, text] of Object.entries(combinedTranslations)) {
      if (text && lang !== this.selectedLanguage) {
        return { text: text as string, languageCode: this.deeplTranslationService.mapLanguageToDeepL(lang) };
      }
    }

    return null;
  }

  wrapSelectionInBold(textArea: HTMLTextAreaElement): void {
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;

    // Wenn etwas markiert wurde (start != end)
    if (start !== null && end !== null && start !== end) {
      // Aktuellen Text auslesen
      const currentText = textArea.value;
      // Markierten Ausschnitt ermitteln
      const selectedText = currentText.substring(start, end);

      // Markierten Text mit <b></b> umschließen
      const boldWrappedText = `<b>${selectedText}</b>`;

      // Neuen Text zusammenbauen
      const before = currentText.substring(0, start);
      const after = currentText.substring(end);

      // Textarea-Inhalt aktualisieren
      this.selectedTextContent = before + boldWrappedText + after;

      // (Optional) Cursorposition aktualisieren, falls nötig
      textArea.selectionStart = start;
      textArea.selectionEnd = start + boldWrappedText.length;
      textArea.focus();

      this.saveCurrentSectionText();
    }
  }

  copyText(textArea: HTMLTextAreaElement): void {
    const textToCopy = textArea.value;

    // Prüfen, ob das Clipboard-Objekt verfügbar ist
    if (navigator && window.navigator['clipboard']) {
      window.navigator['clipboard'].writeText(textToCopy)
        .then(() => {
          // Erfolgsfall
        })
        .catch(err => {
          // Fehlerbehandlung
          console.error('Error while copying text into clipboard: ', err);
        });
    } else {
      // Fallback für ältere Browser
      this.fallbackCopyText(textToCopy);
    }
  }

  private fallbackCopyText(text: string): void {
    // Funktioniert in vielen älteren Browsern über document.execCommand('copy')
    const textarea = document.createElement('textarea');
    textarea.value = text;

    // Element kurz ins DOM einfügen
    document.body.appendChild(textarea);

    // TextArea-Inhalt markieren
    textarea.select();
    textarea.setSelectionRange(0, 99999); // Für Mobile-Devices

    // Befehl ausführen
    document.execCommand('copy');

    // Element wieder entfernen
    document.body.removeChild(textarea);

    console.log('Text wurde mit Fallback in die Zwischenablage kopiert!');
  }

  copyGermanText(): void {
    const translationKey = this.getSelectedTranslationKey();
    if (!translationKey || !this.qtfFile?.TEXTS?.[translationKey]) {
      return;
    }

    const textToCopy = this.qtfFile.TEXTS[translationKey].TRANSLATIONS['GERMAN'];
    if (window.navigator && window.navigator['clipboard']) {
      window.navigator['clipboard'].writeText(textToCopy);
    }
  }

  copyEnglishText(): void {
    const translationKey = this.getSelectedTranslationKey();
    if (!translationKey || !this.qtfFile?.TEXTS?.[translationKey]) {
      return;
    }

    const textToCopy = this.qtfFile.TEXTS[translationKey].TRANSLATIONS['ENGLISH'];
    if (window.navigator && window.navigator['clipboard']) {
      window.navigator['clipboard'].writeText(textToCopy);
    }
  }

  onImageWidthChanged(event) {
    // console.log("width changed: ", this.selectedSection.type, " ", this.selectedSection.value);
    const newWidth = event.target.value;
    const imageValue = this.selectedSection.value;
    if (isImageContentType(this.selectedSection.type) && (newWidth !== 'undefined')) {
      this.selectedSection.width = newWidth;
      this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;
      this.saveCurrentSectionText();
      this.onTopLevelChange(this.selectedTopLevelKey);
      this.onSelectSection(imageValue);
    }
  }

  onPdfWidthChanged(event) {
    // console.log("pdf width changed: ", this.selectedSection.type, " ", this.selectedSection.value);
    const newWidth = event.target.value;
    const imageValue = this.selectedSection.value;
    if (isImageContentType(this.selectedSection.type) && (newWidth !== 'undefined')) {
      this.selectedSection.pdfWidth = newWidth;
      this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;
      this.saveCurrentSectionText();
      this.onTopLevelChange(this.selectedTopLevelKey);
      this.onSelectSection(imageValue);
    }
  }

  onImageBorderChanged(event) {
    const newBorder = !!event.target.checked;
    const imageValue = this.selectedSection.value;
    if (isImageContentType(this.selectedSection.type)) {
      this.selectedSection.border = newBorder;
      this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;
      this.saveCurrentSectionText();
      this.onTopLevelChange(this.selectedTopLevelKey);
      this.onSelectSection(imageValue);
    }
  }

  private ensureTranslationBucket(language: string | null | undefined): void {
    if (!language) {
      return;
    }

    if (!this.translateService.translations?.[language]) {
      this.translateService.setTranslation(language, {}, true);
    }
  }
}

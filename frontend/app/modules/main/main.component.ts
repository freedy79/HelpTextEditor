import { Component, ComponentFactoryResolver, ElementRef, HostListener, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import { FileIOService } from '~shared/services/file-io.service';
import { HelpTextRoot, MainHelpSection, HelpTextSection, parseHelpTextRoot, parseMainHelpSection, HelpTextRootKey, HelpContentType, HelpTextStep } from '~/app/models/help-text-structure.model';
import { createNewQtfItem, QtfFile, QtfTextEntry, removeQtfItem, TextKey } from '../../models/qtf-file.model';
import { MenuItemModel } from '~/app/components/header-menu/menu-item.model';
import { TranslateService } from '@ngx-translate/core';
import { ContextMenuComponent } from '~/app/components/context-menu/app-context-menu.component';
import { ImagePickerDialogComponent, ImagePickerDialogData } from '~/app/dialogs/image-picker-dialog/image-picker-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogService } from '~/app/dialogs/confirmation-dialog/confirmation-dialog.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit {

  helpTextRoot: HelpTextRoot | null = null;
  qtfFile: QtfFile | null = null;

  allowedKeys = ['APPLICATION', '_FILE_NAME', 'TROUBLESHOOTING', 'ABBREVIATION_TITLE', 'SETTING_UP', 'USER_STEPS', 'APPENDIX', 'PASSWORD', 'OPEN_SETTINGS_MENU'] as const;

  public showOverlayFileOpen = false;
  public showOverlayAddContent = false;
  contextmenu = false;
  contextmenuX = 0;
  contextmenuY = 0;

  languages = ['GERMAN', 'ENGLISH', 'FRENCH', 'CHINESE', 'RUSSIAN',  'SPANISH', 'ITALIAN', "JAPANESE", "KOREAN"];
  selectedLanguage = 'GERMAN';

  // Aktuell gewählter Top-Level-Key (z. B. HELP_TEXT_DEVICE_CONCEPT)
  selectedTopLevelKey: string | null = null;

  currentMainHelpSection: MainHelpSection = null;

  selectedSection: HelpTextSection | null = null;
  selectedTextContent = '';

  isDirty: boolean = false;

  componentRef: any;
  @ViewChild('context', { read: ViewContainerRef, static: true }) entry: ViewContainerRef;

  // HTML-Preview des aktuell gewählten Top-Level-Teils
  previewHtml = '';

  public menuItems: MenuItemModel[] = [
    {
      text: 'File',
      iconCss: 'em-icons e-file',
      items: [
        { text: 'Open', iconCss: 'em-icons e-open', clickId: 'openfile' },
        { text: 'Open asset', iconCss: 'em-icons e-open', clickId: 'openasset' },
        { text: 'Save', iconCss: 'em-icons e-save', clickId: 'savefile' }
      ]
    },
    {
      text: 'Insert',
      iconCss: 'em-icons e-file',
      items: [
        { text: 'Help file', iconCss: 'em-icons e-open', clickId: 'addHelpFile' },
        { text: 'Main section', iconCss: 'em-icons e-open', clickId: 'addMainSection' },
        { separator: true },
        { text: 'Subsection', iconCss: 'em-icons e-open', clickId: 'addSubsection' },
        { text: 'Content', iconCss: 'em-icons e-open', clickId: 'addContent' },
        { text: 'Step', iconCss: 'em-icons e-open', clickId: 'addStep' },
      ]
    },
    {
      text: 'Edit',
      iconCss: 'em-icons e-file',
      items: [
        { text: 'Clean QTF', iconCss: 'em-icons e-open', clickId: 'cleanQtf' },
        { separator: true },
        { text: 'Copy', iconCss: 'em-icons e-open', clickId: 'copy', enabled: false },
        { text: 'Delete', iconCss: 'em-icons e-open', clickId: 'delete' }
      ]
    }
  ];

  constructor(private fileService: FileIOService, private translateService: TranslateService,
    public appComponentRef: ElementRef, private resolver: ComponentFactoryResolver, private dialog: MatDialog,
    private confirmDialogService: ConfirmDialogService, private http: HttpClient) { }

  ngOnInit(): void {
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload($event: BeforeUnloadEvent) {
    if (this.isDirty) {
      $event.preventDefault();
      //$event.returnValue = "";
      console.log("Triggered beforeunload");
      this.onSave();
    }
  }

  @HostListener('window:unload', ['$event'])
  beforeunload($event: any) {
    if (this.isDirty) {
      console.log("Saving before unload");
      this.onSave();
    }
  }

  public onMenuItemClicked(item) {
    if (item.clickId == "openfile") {
      this.openOverlayFileOpen();
    } else if (item.clickId == "savefile") {
      this.onSave();
    } else if (item.clickId == "openasset") {
      this.onLoadFromAsset();
    } else if (item.clickId == "addMainSection") {
      this.createNewMainsection();
    } else if (item.clickId == "addSubsection" && this.selectedSection) {
      this.createNewSubsection();
    } else if (item.clickId == "addContent" && this.selectedSection) {
      this.openOverlayAddContent();
    } else if (item.clickId == "addStep" && this.selectedSection) {
      this.createNewStep();
    } else if (item.clickId == "cleanQtf") {
      this.cleanQtf();
    } else if (item.clickId == "copy") {
      this.copy();
    }
  }

  copy() {
    const apiUrl = "http://localhost:3000/api/upload";

    const corsHeaders = new HttpHeaders({
      'Content-Type': 'application/text',
      'Accept': 'application/text',
      'Access-Control-Allow-Origin': 'http://localhost:3000'
    });

    console.log("send request");
    this.http.get(apiUrl, { headers: corsHeaders, responseType: 'text' }).subscribe(config => {
      console.log("Config: ", config);
    }, (error) => {
      console.error(error);
    });
  }

  onLoadFromAsset() {
    console.log("load asset");
    this.fileService.loadHelpTextStructure().subscribe(data => {
      this.helpTextRoot = data;
      const keys = this.getRootKeys();
      if (keys.length > 0) {
        this.onTopLevelChange(keys[0]);
      }
    });
    this.fileService.loadQtfFile().subscribe(qtf => {
      this.qtfFile = qtf;
      this.loadTextsFromQtf(this.selectedLanguage);
    });
  }

  onSave() {
    this.saveCurrentSectionText();

    if (this.helpTextRoot) {
      this.fileService.downloadJson(this.helpTextRoot, 'helpTexts.json');
    }
    if (this.qtfFile) {
      this.fileService.downloadJson(this.qtfFile, 'HELPTEXT.qtf');
    }

    this.isDirty = false;
  }

  getRootKeys(): string[] {
    if (!this.helpTextRoot) return [];
    return Object.keys(this.helpTextRoot);
  }

  getSelectedItem(): MainHelpSection | null {
    if (!this.helpTextRoot || !this.selectedTopLevelKey) return null;
    return (this.helpTextRoot as any)[this.selectedTopLevelKey] as MainHelpSection;
  }

  onSelectTreeViewItem(event) {
    if (event) {
      this.onSelectSection(event as string);

      // scroll to position
      const elementId = this.selectedSection?.value || (event as string);
      const el = elementId ? document.getElementById(elementId) : null;
      if (el) {
        el.scrollIntoView();
      }
    }
  }

  onAddSubsection(section: HelpTextSection) {
    this.selectedSection = section;
    this.createNewSubsection();
  }

  onAddContent(section: HelpTextSection | MainHelpSection) {
    if (!section) { return; }
    if (section instanceof HelpTextSection) {
      this.selectedSection = section;
      this.openOverlayAddContent();
    }
  }

  onAddStep(section: HelpTextSection) {
    this.selectedSection = section;
    this.createNewStep();
  }

  onDeleteTreeSection(section: HelpTextSection | HelpTextStep) {
    this.deleteItem(section);
  }

  onMoveSection(event: { parent: HelpTextSection | MainHelpSection; container: string; index: number; direction: 'up' | 'down' }) {
    if (!event || !event.parent || !event.container) { return; }

    const collection = (event.parent as any)[event.container] as any[];
    if (!collection || event.index < 0 || event.index >= collection.length) { return; }

    const targetIndex = event.direction === 'up' ? event.index - 1 : event.index + 1;
    if (targetIndex < 0 || targetIndex >= collection.length) { return; }

    const [item] = collection.splice(event.index, 1);
    collection.splice(targetIndex, 0, item);

    this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;
    this.saveCurrentSectionText();
    this.onTopLevelChange(this.selectedTopLevelKey);

    if (item && (item as HelpTextSection).value) {
      this.onSelectSection((item as HelpTextSection).value);
    }
  }

  onSelectSection(contentId: string) {
    if (!this.currentMainHelpSection || contentId == "") {
      console.log("currenthelp text item is undefined.");
      this.selectedSection = undefined;
      return;
    }

    this.saveCurrentSectionText();

    console.log("Selection: ", contentId);
    this.selectedSection = this.currentMainHelpSection.findSectionById(contentId);
    if (this.selectedSection) {
      if (this.selectedSection.type == "TABLE") {
        this.loadTextFromQtf(contentId);
      }
      else this.loadTextFromQtf(this.selectedSection.getTranslationKey());
    } else {
      console.error("Could not find ", contentId, " in ", this.currentMainHelpSection);
    }
  }

  onOpenBrowserContext(event) {
    event.preventDefault();
    this.entry.clear();
    const factory = this.resolver.resolveComponentFactory(ContextMenuComponent);
    this.componentRef = this.entry.createComponent(factory);
  }

  //disables the menu
  disableContextMenu() {
    this.contextmenu = false;
  }

  onLanguageChange(event) {
    this.loadTextsFromQtf(this.selectedLanguage);
    this.selectedSection.getTranslationKey();

    if (this.selectedSection) {
      this.loadTextFromQtf(this.selectedSection.getTranslationKey());
    }
  }

  loadTextsFromQtf(language: string) {
    if (!this.qtfFile || !language) {
      return;
    }

    console.log("Website load user language: " + language);

    let key: TextKey;
    for (key in this.qtfFile.TEXTS) {
      const entry: QtfTextEntry = this.qtfFile.TEXTS[key];
      const translation = entry.TRANSLATIONS[this.selectedLanguage] || '[missing]';
      this.translateService.set(key, translation);
    }
  }

  loadTextFromQtf(key: string) {
    if (!this.qtfFile || !key) {
      this.selectedTextContent = '';
      return;
    }

    //console.log("Loading from key: ", key);
    this.translateService.get(key).subscribe(res => {
      this.selectedTextContent = res;
    });
  }

  saveCurrentSectionText() {
    if (!this.selectedSection || !this.qtfFile) return;

    this.isDirty = true;

    const key: string = this.selectedSection.getTranslationKey();
    //console.log("saving: ", key, " - ", this.selectedTextContent);
    if (!key) return;
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
    if (this.qtfFile.TEXTS[key].TRANSLATIONS[this.selectedLanguage] != this.selectedTextContent) {
      this.qtfFile.TEXTS[key].TRANSLATIONS[this.selectedLanguage] = this.selectedTextContent;
      this.translateService.set(key, this.selectedTextContent);

      if (this.selectedLanguage == "GERMAN") {
        this.languages.forEach(language => {
          if (language != "GERMAN") {
            this.qtfFile.TEXTS[key].TRANSLATIONS[language] = "";
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

    const newKey = "NEW_SECTION_" + Math.random().toString(20).substring(2, 4);
    var newItem: HelpTextSection = this.currentMainHelpSection.addSection(newKey);
    console.log("created: ", newItem);

    if (this.qtfFile) {
      this.qtfFile.TEXTS[newKey] = createNewQtfItem(this.selectedLanguage, "new text");
    }
    this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;
    this.onTopLevelChange(this.selectedTopLevelKey);
    this.onSelectSection(newItem.value);
  }

  createNewSubsection() {
    if (!this.currentMainHelpSection || !this.selectedSection) {
      return;
    }
    this.saveCurrentSectionText();

    if (this.selectedSection.type == "INSTRUCTION" || !this.selectedSection.type || this.selectedSection.type == "") {
      const newKey = "NEW_SECTION_" + Math.random().toString(20).substring(2, 4);
      var newItem: HelpTextSection = this.selectedSection.addSubsection(newKey);
      console.log("created: ", newItem);

      if (this.qtfFile) {
        this.qtfFile.TEXTS[newKey] = createNewQtfItem(this.selectedLanguage, "new text");
      }
      this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;
      this.onTopLevelChange(this.selectedTopLevelKey);
      this.onSelectSection(newItem.value);
    } else {
      console.log("selected type: ", this.selectedSection.type);
    }
  }

  createNewStep() {
    if (!this.currentMainHelpSection || !this.selectedSection) {
      return;
    }
    this.saveCurrentSectionText();

    console.log("Create step near by ", this.selectedSection.value);

    let parentSection: HelpTextSection = null;
    if (this.currentMainHelpSection && this.currentMainHelpSection != null) {
      if (this.selectedSection.type == HelpContentType.ENUMERATION || this.selectedSection.type == HelpContentType.BULLET_ENUMERATION) {
        parentSection = this.selectedSection;
      } else {
        console.log("searching in HelpSection");
        parentSection = this.currentMainHelpSection.findParentOfSectionById(this.selectedSection.value);
      }

      if (!parentSection) {
        console.log("Parent not found for ", this.selectedSection.value);
        return;
      }

      if (parentSection.type == HelpContentType.ENUMERATION || parentSection.type == HelpContentType.BULLET_ENUMERATION) {
        let newStepId = parentSection.value + "_ENUM_123";
        parentSection.addStep(newStepId);
        console.log("Step created ");
        this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;
        this.saveCurrentSectionText();
        this.onTopLevelChange(this.selectedTopLevelKey);
        this.onSelectSection(newStepId);
      } else {
        console.error("Parent is not an enumeration type. ", parentSection.value, " Type: ", parentSection.type);
        return;
      }
    } else {
      console.log("No currentMainHelpSection");
    }
  }

  deleteItem(sectionToDelete: HelpTextSection | HelpTextStep) {
    let parentSection: HelpTextSection = null;
    if (this.currentMainHelpSection && this.currentMainHelpSection != null) {
      parentSection = this.currentMainHelpSection.findParentOfSectionById(sectionToDelete.value);
    }
    if (!parentSection) {
      console.error("Parent not found for ", sectionToDelete.value);
      return;
    }

    //console.log("Found parent: ", parentSection.value);

    let removed = parentSection.removeId(sectionToDelete.value);
    if (removed && this.selectedSection && (sectionToDelete.value == this.selectedSection.value)) {
      this.selectedSection = undefined;
    }

    this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;
    this.saveCurrentSectionText();
    this.onTopLevelChange(this.selectedTopLevelKey);
  }

  getImageLanguage(): String {
    if (this.selectedLanguage == "ENGLISH") {
      return "EN"
    } else if (this.selectedLanguage == "GERMAN") {
      return "DE"
    } else if (this.selectedLanguage == "FRENCH") {
      return "FR"
    }
    return "EN";
  }

  onIdChanged(event) {
    let newId = event.target.value;
    //console.log("old id ", this.selectedSection.value, " - new id", newId);

    if (this.selectedSection.getTranslationKey() == newId) {
      return;
    }

    if (this.currentMainHelpSection.idExists(newId)) {
      alert("Id already exists.");
    }

    if (newId != "") {
      let oldId = this.selectedSection.getTranslationKey();
      let changed = this.currentMainHelpSection.changeValueId(oldId, newId);
      if (changed) {
        console.log("Id changed. Old: ", oldId, " -> ", newId, ": ", changed);
        this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;

        if (this.qtfFile && this.qtfFile.TEXTS && this.qtfFile.TEXTS[oldId]) {
          this.qtfFile.TEXTS[newId] = this.qtfFile.TEXTS[oldId];
          delete this.qtfFile.TEXTS[oldId];
        }

        this.saveCurrentSectionText();
        this.onTopLevelChange(this.selectedTopLevelKey);
        this.onSelectSection(newId);
      }
    }
  }

  onLinkChanged(event) {
    let newLink = event.target.value;

    if ((this.selectedSection.linkId != newLink) && (newLink != "")) {
      console.log("onLinkChanged");
      let currentValue = this.selectedSection.value;

      this.selectedSection.linkId = newLink;
      console.log("New link id: ", newLink, " for section: ", this.selectedSection.value);
      this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;
      this.saveCurrentSectionText();
      this.onTopLevelChange(this.selectedTopLevelKey);
      this.onSelectSection(currentValue);
    }
  }

  onTranslationChanged(newText: string) {
    this.selectedTextContent = newText;
    this.saveCurrentSectionText();
  }

  onImageFileChanged(event) {
    let newImageFile = event.target.value;
    //console.log("Image to change: ", this.selectedSection.value, " new: ", newImageFile);
    if (newImageFile != "" && this.selectedSection.value != newImageFile) {
      let changed = this.currentMainHelpSection.changeValueId(this.selectedSection.value, newImageFile);
      console.log("Image changed: ", changed, " new: ", newImageFile);
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
    //console.log("Top key: ", this.selectedTopLevelKey, typeof (this.currentMainHelpSection));
    //console.log("item class: ", this.currentMainHelpSection.constructor.name);
    //console.log(this.currentMainHelpSection instanceof MainHelpSection);
    //console.log(this.currentMainHelpSection);
    this.selectedSection = undefined;
    this.selectedTextContent = '';
  }

  openOverlayFileOpen() {
    this.showOverlayFileOpen = true;
  }

  openOverlayAddContent() {
    this.showOverlayAddContent = true;
  }

  closeOverlayFileOpen(data: { cancelled: boolean; files?: { jsonData: any; qtfData: any } }) {
    // Overlay ausblenden
    this.showOverlayFileOpen = false;

    if (!data.cancelled && data.files) {
      this.helpTextRoot = parseHelpTextRoot(data.files.jsonData);
      const keys = this.getRootKeys();
      if (keys.length > 0) {
        this.selectedTopLevelKey = keys[0];
      }
      this.qtfFile = data.files.qtfData;

      this.loadTextsFromQtf(this.selectedLanguage);
    } else {
      console.log('Upload abgebrochen');
    }
  }

  closeOverlayAddContent(data: { cancelled: boolean; type?: string, insertPosition?: string }) {
    this.showOverlayAddContent = false;
    console.log("Cancelled ", data.cancelled, " type: ", data.type, " pos: ", data.insertPosition);

    if (!data || data.cancelled || !data.type || !data.insertPosition) {
      return;
    }

    this.saveCurrentSectionText(); // Änderungen des aktuellen Editors sichern

    console.debug("Creating new for parent: ", this.selectedSection.value);

    let parentSection: HelpTextSection = null;

    if (!this.selectedSection.type || this.selectedSection.type == "") {
      parentSection = this.selectedSection;
    }
    else if (data.type == "STEP" && (this.selectedSection.type == HelpContentType.ENUMERATION) || (this.selectedSection.type == HelpContentType.BULLET_ENUMERATION)) {
      parentSection = this.selectedSection;
    }
    else if (this.currentMainHelpSection) {
      parentSection = this.currentMainHelpSection.findParentOfSectionById(this.selectedSection.value);
    }

    if (!parentSection) {
      console.log("Parent not found for ", this.selectedSection.value);
      return;
    }

    const newKey = parentSection.value + '_' + data.type + "_" + Math.random().toString(36).substring(2);
    const newLinkId = 'LINK_' + Math.random().toString(36).substring(2);
    const newItem: HelpTextSection = new HelpTextSection;
    newItem.linkId = newLinkId;
    newItem.value = newKey;

    newItem.linkId = "";
    newItem.type = data.type;

    if (data.type == "IMAGE" || data.type == "SPLITIMAGE") {
      newItem.value = "empty";
      newItem.imageDescription = newKey;
    }

    console.log("parent ", parentSection.constructor.name, " value: ", parentSection.value);
    if (!parentSection.content) {
      parentSection.content = [];
    }
    console.log(parentSection.content);

    if (this.selectedSection.type && data.insertPosition == "after" && parentSection.content.length > 1) {
      let selectedIndex = parentSection.getIndexOfId(this.selectedSection.value);
      parentSection.content.splice(selectedIndex, 0, newItem);
    } else {
      parentSection.content.push(newItem);
      console.log(parentSection.content);
    }

    // Neuen Eintrag in der QTF-Struktur anlegen
    if (this.qtfFile) {
      this.qtfFile.TEXTS[newKey] = createNewQtfItem(this.selectedLanguage, "new text");
    }

    if (data.type == HelpContentType.BULLET_ENUMERATION || data.type == HelpContentType.ENUMERATION) {
      newItem.addStep("New step");
    }

    this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;
    this.saveCurrentSectionText();
    this.onTopLevelChange(this.selectedTopLevelKey);
    this.onSelectSection(newItem.value);
  }

  openImagePicker(): void {
    // Beispiel: Wir übergeben einen initialen Dateinamen
    const initialFilename = 'logo.png';

    const dialogData: ImagePickerDialogData = {
      initialFilename
    };

    const dialogRef = this.dialog.open(ImagePickerDialogComponent, {
      width: '600px',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe((result) => {
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

    let key: TextKey;
    var deletedItems = 0;
    var breakClean: boolean = false;
    for (key in this.qtfFile.TEXTS) {
      if (!this.keywordInList(key) && !this.helpTextRootIdExists(key)) {
        console.log("Id ", key, " seems not to be used in helpText. Removing...");

        const result = await this.confirmDialogService.openConfirmDialog(key);

        if (result === 'yes') {
          deletedItems++;
          this.qtfFile = removeQtfItem(this.qtfFile, key);
        } else if (result === 'no') {
          console.log(`User chose NO -> Do not delete "${key}"`);
        } else {
          breakClean = true;
        }
      }

      if (breakClean) {
        console.log("break");
        break;
      }
    }

    console.log("Number of deleted items: ", deletedItems);
    if (deletedItems > 0) {
      this.isDirty = true;
    }
  }

  private helpTextRootIdExists(key: string): boolean {
    const root = this.ensureParsedHelpTextRoot();
    return !!(root && typeof root.idExists === 'function' && root.idExists(key));
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
      s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = this.allowedKeys.map(escape).join('|');
    const re = new RegExp(`^(?:${pattern})$|${pattern}`);
    return re.test(keyword);
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
    var textToCopy = this.qtfFile.TEXTS[this.selectedSection.value].TRANSLATIONS["GERMAN"];
    if (window.navigator && window.navigator['clipboard']) {
      window.navigator['clipboard'].writeText(textToCopy);
    }
  }

  copyEnglishText(): void {
    var textToCopy = this.qtfFile.TEXTS[this.selectedSection.value].TRANSLATIONS["ENGLISH"];
    if (window.navigator && window.navigator['clipboard']) {
      window.navigator['clipboard'].writeText(textToCopy);
    }
  }

  onImageWidthChanged(event) {
    //console.log("width changed: ", this.selectedSection.type, " ", this.selectedSection.value);
    let newWidth = event.target.value;
    let imageValue = this.selectedSection.value;
    if ((this.selectedSection.type == "IMAGE") && (newWidth != "undefined")) {
      this.selectedSection.width = newWidth;
      this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;
      this.saveCurrentSectionText();
      this.onTopLevelChange(this.selectedTopLevelKey);
      this.onSelectSection(imageValue);
    }
  }

  onPdfWidthChanged(event) {
    //console.log("pdf width changed: ", this.selectedSection.type, " ", this.selectedSection.value);
    let newWidth = event.target.value;
    let imageValue = this.selectedSection.value;
    if ((this.selectedSection.type == "IMAGE") && (newWidth != "undefined")) {
      this.selectedSection.pdfWidth = newWidth;
      this.helpTextRoot[this.selectedTopLevelKey as HelpTextRootKey] = this.currentMainHelpSection;
      this.saveCurrentSectionText();
      this.onTopLevelChange(this.selectedTopLevelKey);
      this.onSelectSection(imageValue);
    }
  }
}

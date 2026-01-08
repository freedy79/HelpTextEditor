import { HelpEditorFacade } from './help-editor-facade.service';

describe('HelpEditorFacade', () => {
  const createFacade = () => {
    const fileService = jasmine.createSpyObj('FileIOService', ['downloadJson']);
    const translateService = jasmine.createSpyObj('TranslateService', ['set']);
    const http = jasmine.createSpyObj('HttpClient', ['get']);
    const deeplTranslationService = jasmine.createSpyObj('DeeplTranslationService', [
      'getStoredAuthKey',
      'mapLanguageToDeepL',
      'translateText',
      'storeAuthKey'
    ]);
    const confirmDialog = jasmine.createSpyObj('ConfirmDialogService', ['openConfirmDialog']);
    const dataService = jasmine.createSpyObj('HelpTextDataService', ['loadHelpTextData']);
    const actionsService = jasmine.createSpyObj('HelpEditorActionsService', [
      'openImagePickerDialog',
      'openCleanQtfDialog',
      'openTranslationIssuesDialog',
      'openDeeplSettingsDialog',
      'openAbbreviationDialog'
    ]);

    return new HelpEditorFacade(
      fileService,
      translateService,
      http,
      deeplTranslationService,
      confirmDialog,
      dataService,
      actionsService
    );
  };

  it('tracks splitter dragging and updates width', () => {
    const facade = createFacade();

    facade.leftColumnWidth = 300;
    facade.leftMinWidth = 220;
    facade.leftMaxWidth = 700;

    facade.onSplitterMouseDown({ clientX: 100, preventDefault: () => {} } as MouseEvent);
    facade.onWindowMouseMove({ clientX: 200 } as MouseEvent);

    expect(facade.isDraggingSplitter).toBeTrue();
    expect(facade.leftColumnWidth).toBe(400);
  });

  it('stops splitter dragging on mouse up', () => {
    const facade = createFacade();
    facade.isDraggingSplitter = true;
    spyOn<any>(facade, 'persistSplitterWidth');

    facade.onWindowMouseUp();

    expect(facade.isDraggingSplitter).toBeFalse();
    expect((facade as any).persistSplitterWidth).toHaveBeenCalled();
  });
});

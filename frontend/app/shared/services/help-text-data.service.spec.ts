import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { HelpTextDataService } from './help-text-data.service';
import { FileIOService } from './file-io.service';

describe('HelpTextDataService', () => {
  let service: HelpTextDataService;
  let fileService: jasmine.SpyObj<FileIOService>;

  beforeEach(() => {
    fileService = jasmine.createSpyObj('FileIOService', ['loadHelpTextStructure', 'loadQtfFile']);
    TestBed.configureTestingModule({
      providers: [
        HelpTextDataService,
        { provide: FileIOService, useValue: fileService }
      ]
    });
    service = TestBed.inject(HelpTextDataService);
  });

  it('loads help text and qtf data together', (done) => {
    const helpTextRoot = { HELP_TEXT_DEVICE_CONCEPT: { content: [] } };
    const qtfFile = { TEXTS: {} };

    fileService.loadHelpTextStructure.and.returnValue(of(helpTextRoot as any));
    fileService.loadQtfFile.and.returnValue(of(qtfFile as any));

    service.loadHelpTextData().subscribe(result => {
      expect(result.helpTextRoot).toBe(helpTextRoot as any);
      expect(result.qtfFile).toBe(qtfFile as any);
      done();
    });
  });
});

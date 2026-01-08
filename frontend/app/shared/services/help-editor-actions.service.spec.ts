import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { HelpEditorActionsService } from './help-editor-actions.service';
import { DeeplSettingsDialogComponent } from '~/app/dialogs/deepl-settings-dialog/deepl-settings-dialog.component';

describe('HelpEditorActionsService', () => {
  let service: HelpEditorActionsService;
  let dialog: jasmine.SpyObj<MatDialog>;

  beforeEach(() => {
    dialog = jasmine.createSpyObj('MatDialog', ['open']);
    dialog.open.and.returnValue({
      afterClosed: () => of({ token: 'abc', rememberToken: false })
    } as any);

    TestBed.configureTestingModule({
      providers: [
        HelpEditorActionsService,
        { provide: MatDialog, useValue: dialog }
      ]
    });
    service = TestBed.inject(HelpEditorActionsService);
  });

  it('opens the DeepL settings dialog', (done) => {
    service.openDeeplSettingsDialog({ token: '', rememberToken: false }).subscribe(() => {
      expect(dialog.open).toHaveBeenCalledWith(DeeplSettingsDialogComponent, jasmine.objectContaining({
        width: '520px'
      }));
      done();
    });
  });
});

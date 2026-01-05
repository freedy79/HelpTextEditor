import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ImagePickerDialogComponent } from './image-picker-dialog.component';

describe('ImagePickerDialogComponent', () => {
  let component: ImagePickerDialogComponent;
  let fixture: ComponentFixture<ImagePickerDialogComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [ ImagePickerDialogComponent ],
      providers: [
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } },
        { provide: MAT_DIALOG_DATA, useValue: {} }
      ]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ImagePickerDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should create', () => {
    httpMock.expectOne('/api/images').flush([]);
    expect(component).toBeTruthy();
  });

  afterEach(() => {
    httpMock.verify();
  });
});

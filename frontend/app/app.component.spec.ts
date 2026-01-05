import { TestBed, async } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { TranslateService } from '@ngx-translate/core';
import { Component } from '@angular/core';

class TranslateServiceMock {
  setDefaultLang = jasmine.createSpy('setDefaultLang');
  use = jasmine.createSpy('use');
}

describe('AppComponent', () => {
  @Component({
    selector: 'app-main',
    template: ''
  })
  class MainComponentStub {}

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [
        AppComponent,
        MainComponentStub
      ],
      providers: [
        { provide: TranslateService, useClass: TranslateServiceMock }
      ]
    }).compileComponents();
  }));

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.debugElement.componentInstance;
    expect(app).toBeTruthy();
  });

  it('initializes the translation service with ENGLISH locale', () => {
    TestBed.createComponent(AppComponent);
    const translate = TestBed.inject(TranslateService) as any;

    expect(translate.setDefaultLang).toHaveBeenCalledWith('ENGLISH');
    expect(translate.use).toHaveBeenCalledWith('ENGLISH');
  });

  it('renders the main component shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.debugElement.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-main')).toBeTruthy();
  });
});

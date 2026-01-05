
import { NgModule } from '@angular/core';
import { ContextMenuComponent } from './context-menu/app-context-menu.component';
import { HeaderMenuComponent } from './header-menu/header-menu.component';
import { HelpSectionComponent } from './help-section/help-section.component';
import { HelpStructureTreeviewComponent } from './help-structure-treeview/help-structure-treeview.component';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { SharedModule } from '../shared/shared.module';
import { StatusbarComponent } from './statusbar/statusbar.component';

@NgModule({
  declarations: [
    ContextMenuComponent,
    HeaderMenuComponent,
    HelpSectionComponent,
    HelpStructureTreeviewComponent,
    StatusbarComponent
  ],
  imports: [
    BrowserModule,
    CommonModule,
    FormsModule,
    SharedModule
  ],
  exports: [
    ContextMenuComponent,
    HeaderMenuComponent,
    HelpSectionComponent,
    HelpStructureTreeviewComponent,
    StatusbarComponent
  ],
  providers: [
    
  ],
  entryComponents: [ContextMenuComponent],
  bootstrap: []
})
export class ComponentsModule { }

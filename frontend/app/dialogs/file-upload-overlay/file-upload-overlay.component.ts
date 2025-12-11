import { Component, EventEmitter, Output, ViewChild, ElementRef } from '@angular/core';

@Component({
  selector: 'app-file-upload-overlay',
  templateUrl: './file-upload-overlay.component.html',
  styleUrls: ['./file-upload-overlay.component.scss']
})
export class FileUploadOverlayComponent {
  @Output() closeOverlay = new EventEmitter<{
    cancelled: boolean;
    files?: { jsonData: any; qtfData: any };
  }>();

  @ViewChild('jsonFileInput', { static: true }) jsonFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('qtfFileInput', { static: true }) qtfFileInput!: ElementRef<HTMLInputElement>;

  // Gespeicherte Daten (nach dem Einlesen)
  private jsonData: any | null = null;
  private qtfData: any | null = null;

  // Gespeicherte Dateinamen (für die UI)
  jsonFileName: string = '';
  qtfFileName: string = '';

  errorMessage: string = '';

  constructor() {}

  selectJsonFile() {
    this.jsonFileInput.nativeElement.click();
  }

  selectQtfFile() {
    this.qtfFileInput.nativeElement.click();
  }

  onJsonFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.jsonFileName = file.name;  // Dateiname merken
      this.errorMessage = '';
      this.readFile(file)
        .then(parsedData => {
          this.jsonData = parsedData;
        })
        .catch(err => {
          console.error('Fehler beim Lesen der JSON-Datei:', err);
          this.errorMessage = 'Die ausgewählte JSON-Datei konnte nicht gelesen werden.';
          this.jsonData = null;
        });
    }
  }

  onQtfFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.qtfFileName = file.name;  // Dateiname merken
      this.errorMessage = '';
      this.readFile(file)
        .then(parsedData => {
          this.qtfData = parsedData;
        })
        .catch(err => {
          console.error('Fehler beim Lesen der QTF-Datei:', err);
          this.errorMessage = 'Die ausgewählte QTF-Datei konnte nicht gelesen werden.';
          this.qtfData = null;
        });
    }
  }

  onOk() {
    if (this.jsonData && this.qtfData) {
      this.closeOverlay.emit({
        cancelled: false,
        files: {
          jsonData: this.jsonData,
          qtfData: this.qtfData
        }
      });
    }
  }

  onCancel() {
    this.closeOverlay.emit({ cancelled: true });
  }

  isOkEnabled(): boolean {
    return this.jsonData !== null && this.qtfData !== null;
  }

  private readFile(file: File): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const content = reader.result as string;
          const parsed = JSON.parse(content);
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => {
        reject(reader.error);
      };
      reader.readAsText(file);
    });
  }
}

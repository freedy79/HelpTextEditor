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

  @ViewChild('fileInput', { static: true }) fileInput!: ElementRef<HTMLInputElement>;

  // Gespeicherte Daten (nach dem Einlesen)
  private jsonData: any | null = null;
  private qtfData: any | null = null;

  // Gespeicherte Dateinamen (für die UI)
  jsonFileName = '';
  qtfFileName = '';

  errorMessage = '';

  constructor() {}

  selectFiles() {
    this.fileInput.nativeElement.value = '';
    this.fileInput.nativeElement.click();
  }

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      const { jsonFile, qtfFile, hasDuplicateJson, hasDuplicateQtf } = this.pickFiles(files);

      this.resetFileState();

      if (hasDuplicateJson || hasDuplicateQtf) {
        this.errorMessage = 'Bitte wählen Sie genau eine JSON- und eine QTF-Datei aus.';
        return;
      }

      if (!jsonFile || !qtfFile) {
        this.errorMessage = 'Bitte wählen Sie sowohl die JSON- als auch die QTF-Datei aus.';
        return;
      }

      this.jsonFileName = jsonFile.name;
      this.qtfFileName = qtfFile.name;

      if (!this.areFileNamesMatching(jsonFile, qtfFile)) {
        this.errorMessage = 'Die Dateinamen der JSON- und QTF-Datei müssen übereinstimmen.';
        return;
      }

      this.errorMessage = '';

      Promise.all([this.readFile(jsonFile), this.readFile(qtfFile)])
        .then(([jsonData, qtfData]) => {
          this.jsonData = jsonData;
          this.qtfData = qtfData;
          this.onOk();
        })
        .catch(err => {
          console.error('Fehler beim Lesen der Dateien:', err);
          this.errorMessage = 'Die ausgewählten Dateien konnten nicht gelesen werden.';
          this.jsonData = null;
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

  private resetFileState() {
    this.jsonData = null;
    this.qtfData = null;
    this.jsonFileName = '';
    this.qtfFileName = '';
  }

  private pickFiles(files: File[]) {
    const jsonFiles = files.filter(file => file.name.toLowerCase().endsWith('.json'));
    const qtfFiles = files.filter(file => file.name.toLowerCase().endsWith('.qtf'));

    return {
      jsonFile: jsonFiles[0],
      qtfFile: qtfFiles[0],
      hasDuplicateJson: jsonFiles.length > 1,
      hasDuplicateQtf: qtfFiles.length > 1
    };
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

  private areFileNamesMatching(jsonFile: File, qtfFile: File): boolean {
    const jsonBaseName = jsonFile.name.replace(/\.json$/i, '');
    const qtfBaseName = qtfFile.name.replace(/\.qtf$/i, '');
    return jsonBaseName === "helpTexts" && qtfBaseName === "HELPTEXT";
  }
}

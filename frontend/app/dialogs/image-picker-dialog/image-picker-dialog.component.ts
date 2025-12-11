import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';

// Struktur für die Daten, die beim Öffnen übergeben werden
export interface ImagePickerDialogData {
  initialFilename?: string; // optionaler, vorgewählter Dateiname
}

@Component({
  selector: 'app-image-picker-dialog',
  templateUrl: './image-picker-dialog.component.html',
  styleUrls: ['./image-picker-dialog.component.scss']
})
export class ImagePickerDialogComponent implements OnInit {
  // Liste aller verfügbaren Bilder (Dateinamen)
  public allImages: string[] = [];
  // Aktuell ausgewähltes Bild
  public selectedImage?: string;
  // Boolean, das steuert, ob OK-Button aktiviert ist
  public get canConfirm(): boolean {
    return !!this.selectedImage; // nur enabled, wenn etwas selektiert ist
  }

  // Im Konstruktor greifen wir auf HttpClient zu,
  // um die Bildliste vom Server zu laden und Uploads durchzuführen.
  constructor(
    private dialogRef: MatDialogRef<ImagePickerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ImagePickerDialogData,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.loadImages();

    // Prüfen, ob bereits ein Bildname übergeben wurde
    if (this.data.initialFilename) {
      // Wir merken uns diese Vorbelegung, tatsächliche Auswahl
      // findet dann statt, wenn das Bild in allImages auftaucht.
      this.selectedImage = this.data.initialFilename;
    }
  }

  /**
   * Lädt die Liste der verfügbaren Bilder vom Server
   */
  private loadImages(): void {
    // Hier den richtigen Endpunkt anpassen; 
    // Beispiel: GET /api/images => gibt string[] mit Dateinamen zurück
    this.http.get<string[]>('/api/images').subscribe({
      next: (filenames) => {
        // Nur PNG- und SVG-Dateien filtern
        const filtered = filenames.filter(fn =>
          fn.toLowerCase().endsWith('.png') || fn.toLowerCase().endsWith('.svg')
        );
        // Alphabetisch sortieren
        filtered.sort((a, b) => a.localeCompare(b));

        this.allImages = filtered;

        // Falls ein initialFilename übergeben wurde und in der Liste enthalten ist:
        if (this.data.initialFilename && this.allImages.includes(this.data.initialFilename)) {
          this.selectedImage = this.data.initialFilename;
        } else {
          // Falls es nicht existiert, setze die Auswahl evtl. auf undefined
          if (!this.allImages.includes(this.selectedImage || '')) {
            this.selectedImage = undefined;
          }
        }
      },
      error: (err) => {
        console.error('Fehler beim Laden der Bilder:', err);
      }
    });
  }

  /**
   * Wird aufgerufen, wenn der User ein Bild anklickt
   */
  public selectImage(filename: string): void {
    this.selectedImage = filename;
  }

  /**
   * Wird aufgerufen, wenn der User eine neue Datei hochladen will
   */
  public onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
    const file = input.files[0];

    // Dateiupload via FormData
    const formData = new FormData();
    formData.append('file', file);

    // POST /api/images/upload (Beispiel-Endpunkt anpassen)
    this.http.post('/api/images/upload', formData).subscribe({
      next: () => {
        // Nach erfolgreichem Upload Liste erneut laden
        this.loadImages();
      },
      error: (err) => {
        console.error('Fehler beim Upload:', err);
      }
    });
  }

  /**
   * OK-Button -> Auswahl bestätigen und Dialog schließen
   */
  public confirmSelection(): void {
    if (this.selectedImage) {
      this.dialogRef.close(this.selectedImage);
    }
  }

  /**
   * „X“-Symbol oder Abbruch -> ohne Auswahl schließen
   */
  public closeWithoutSelection(): void {
    this.dialogRef.close(null);
  }
}

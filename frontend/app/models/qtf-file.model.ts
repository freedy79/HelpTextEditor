export enum Languages {
    GERMAN        = 'GERMAN',
    ENGLISH       = 'ENGLISH',
    FRENCH        = 'FRENCH',
    SPANISH       = 'SPANISH',
    ITALIAN       = 'ITALIAN',
    JAPANESE      = 'JAPANESE',
    RUSSIAN       = 'RUSSIAN',
    CHINESE       = 'CHINESE',
    PORTUGUESE    = 'PORTUGUESE',
    KOREAN        = 'KOREAN'
}

type TextEntry = { 
    [key: string]: QtfTextEntry;
  }

export interface QtfFile {
    TEXTS: TextEntry;
}

export type TextKey = keyof TextEntry;

export interface QtfTextEntry {
    group: string;
    topic: string;
    comment: string;
    locked: boolean;
    obsolete: boolean;

    TRANSLATIONS: { [lang: string]: string };
    AUTOTRANSLATIONS: { [lang: string]: string };
    VERIFIED: { [lang: string]: boolean };
}

export function createNewQtfItem(lang: string, text: string) : QtfTextEntry {
  var newItem : QtfTextEntry;

  newItem = {
          group: 'HELP_INSTRUCTION',
          topic: 'HELPTEXT',
          comment: ``,
          locked: false,
          obsolete: false,
          TRANSLATIONS: { [lang]: text },
          AUTOTRANSLATIONS: {},
          VERIFIED: {}
        };

  return newItem;
}

export function removeQtfItem(qtfFile: QtfFile, key: TextKey): QtfFile {
  if (qtfFile.TEXTS.hasOwnProperty(key)) {
    delete qtfFile.TEXTS[key];
  }
  return qtfFile;
}
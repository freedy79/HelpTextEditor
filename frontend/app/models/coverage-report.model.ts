export interface CoverageReference {
  kind: 'HelpTextSection' | 'HelpTextStep' | 'Table' | 'Image' | 'Abbreviation';
  label: string;
}

export interface CoverageKeyUsage {
  key: string;
  references: CoverageReference[];
}

export interface CoverageLanguageReport {
  language: string;
  missing: CoverageKeyUsage[];
}

export interface CoverageReport {
  usedKeys: CoverageKeyUsage[];
  missingKeys: CoverageKeyUsage[];
  missingTranslations: CoverageLanguageReport[];
  duplicateKeys: CoverageKeyUsage[];
  unusedQtfKeys: string[];
}

export interface HelpTocItem {
  /** The anchor target in the DOM (prefer linkId from JSON). */
  linkId: string;

  /** Translation key (e.g. DEVICE_CONCEPT_USAGE_TITLE). */
  key: string;

  /** Level in the hierarchy (1,2,3...). */
  level: number;

  /** Children. */
  children: HelpTocItem[];
}

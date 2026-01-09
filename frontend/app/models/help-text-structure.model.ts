export enum HelpContentType {
  INSTRUCTION = 'INSTRUCTION',
  INSTRUCTION_BOLD = 'INSTRUCTION_BOLD',
  INTRODUCTION = 'INTRODUCTION',
  IMAGE = 'IMAGE',
  SPLITIMAGE = 'SPLITIMAGE',
  ENUMERATION = 'ENUMERATION',
  BULLET_ENUMERATION = 'BULLET_ENUMERATION',
  TABLE = 'TABLE',
}

export interface HelpNodeBase {
  id: string;
  type: HelpContentType | 'STEP';
  linkId?: string;
}

export interface TextSection extends HelpNodeBase {
  type:
    | HelpContentType.INSTRUCTION
    | HelpContentType.INSTRUCTION_BOLD
    | HelpContentType.INTRODUCTION
    | HelpContentType.ENUMERATION
    | HelpContentType.BULLET_ENUMERATION;
  value?: string;
  steps?: HelpTextStep[];
}

export interface ImageSection extends HelpNodeBase {
  type: HelpContentType.IMAGE | HelpContentType.SPLITIMAGE;
  value?: string;
  imageDescription?: string;
  pdfWidth?: Number;
  width?: string;
  height?: string;
  border?: boolean;
}

export interface TableSection extends HelpNodeBase {
  type: HelpContentType.TABLE;
  header: TableCellValue[];
  rows?: RowItem[];
}

export interface StepNode extends HelpNodeBase {
  type: 'STEP';
  value: string;
  substeps?: StepNode[];
}

const VALUELESS_CONTENT_TYPES = new Set<HelpContentType>([
  HelpContentType.ENUMERATION,
  HelpContentType.BULLET_ENUMERATION,
  HelpContentType.TABLE,
]);

const DEFAULT_ID_PREFIX = 'help-node';

export const NON_NESTABLE_CONTENT_TYPES = new Set<HelpContentType>([
  HelpContentType.INSTRUCTION,
  HelpContentType.INSTRUCTION_BOLD,
  HelpContentType.IMAGE,
  HelpContentType.SPLITIMAGE,
]);

export interface StructureIssue {
  sectionKey: string;
  message: string;
}

export function createHelpNodeId(seed?: string): string {
  if (seed) {
    return seed;
  }

  const cryptoRef =
    typeof globalThis !== 'undefined'
      ? (globalThis as typeof globalThis & { crypto?: { randomUUID?: () => string } }).crypto
      : undefined;
  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }

  const entropy = Math.random().toString(36).slice(2);
  return `${DEFAULT_ID_PREFIX}-${Date.now().toString(36)}-${entropy}`;
}

export function isTableContentType(type?: HelpContentType | string): type is HelpContentType.TABLE {
  return type === HelpContentType.TABLE;
}

export function isImageContentType(
  type?: HelpContentType | string
): type is HelpContentType.IMAGE | HelpContentType.SPLITIMAGE {
  return type === HelpContentType.IMAGE || type === HelpContentType.SPLITIMAGE;
}

export function isInstructionContentType(
  type?: HelpContentType | string
): type is HelpContentType.INSTRUCTION | HelpContentType.INSTRUCTION_BOLD {
  return type === HelpContentType.INSTRUCTION || type === HelpContentType.INSTRUCTION_BOLD;
}

export function isEnumerationContentType(
  type?: HelpContentType | string
): type is HelpContentType.ENUMERATION | HelpContentType.BULLET_ENUMERATION {
  return type === HelpContentType.ENUMERATION || type === HelpContentType.BULLET_ENUMERATION;
}

export function isTableSection(section?: HelpTextSection | null): section is HelpTextTable {
  return !!section && isTableContentType(section.type);
}

export function isImageSection(section?: HelpTextSection | null): section is HelpTextSection {
  return !!section && isImageContentType(section.type);
}

export function isStepNode(node?: HelpTextStep | null): node is HelpTextStep {
  return !!node && node.type === 'STEP';
}

export function isNonNestableType(type?: HelpContentType | string): boolean {
  if (!type) {
    return false;
  }

  return NON_NESTABLE_CONTENT_TYPES.has(type as HelpContentType);
}

export function isValuelessContentType(type?: HelpContentType | string): boolean {
  if (!type) {
    return false;
  }

  return VALUELESS_CONTENT_TYPES.has(type as HelpContentType);
}

export function getSectionSelectionId(section?: HelpTextSection | HelpTextStep | null): string | null {
  if (!section) {
    return null;
  }

  if (isStepNode(section as HelpTextStep)) {
    return (section as HelpTextStep).id || (section as HelpTextStep).value || null;
  }

  return (section as HelpTextSection).id || (section as HelpTextSection).value || null;
}

export function matchesSectionId(section: HelpTextSection, contentId: string): boolean {
  if (!contentId) {
    return false;
  }

  return section.id === contentId || section.value === contentId;
}

export type HelpTextRootKey = string;

export const HELP_TEXT_ROOT_KEYS: HelpTextRootKey[] = [
  'HELP_TEXT_DEVICE_CONCEPT',
  'HELP_TEXT_TASKS_CONCEPT',
  'HELP_TEXT_PRINT_CONCEPT',
  'HELP_TEXT_USER_MANAGEMENT',
  'HELP_TEXT_NETWORK_CONNECTION',
  'HELP_TEXT_WEIGHING_FUNCTION',
  'HELP_TEXT_TIMER_CNTRL_ACTION',
  'HELP_TEXT_DEVICE_CLEANING',
  'HELP_TEXT_DEVICE_MAINTENANCE',
  'HELP_TEXT_JOB_MANAGEMENT'
];

export type HelpTextRootFormat = 'keyed' | 'standalone-array' | 'standalone-content';

export const STANDALONE_SECTION_KEY = 'HELP_TEXT_STANDALONE';

type SectionCollection = HelpTextSection[] | undefined;

class SectionCollections {
  constructor(private readonly collectionFactory: () => SectionCollection[]) {}

  public findSectionById(contentId: string): HelpTextSection | null {
    return findSectionInCollections(this.collectionFactory(), contentId);
  }

  public findParentOfSectionById(contentId: string, directParent: HelpTextSection | null): HelpTextSection | null {
    return findParentInCollections(this.collectionFactory(), contentId, directParent);
  }

  public changeValueId(oldId: string, newId: string): boolean {
    return changeValueIdInCollections(this.collectionFactory(), oldId, newId);
  }

  public idExists(key: string): boolean {
    return idExistsInCollections(this.collectionFactory(), key);
  }

  public removeId(contentId: string): boolean {
    return removeFromCollections(this.collectionFactory(), contentId);
  }
}

export class HelpTextStep {
  id: string;
  value: string;
  type = 'STEP';
  substeps?: HelpTextStep[];

  constructor() {
    this.id = createHelpNodeId();
  }

  public getTranslationKey(): string {
    return this.value;
  }
}

export class HelpTextSection {
  id: string;
  linkId: string;
  value: string; // Key, der in der QTF-Übersetzung steht
  type: HelpContentType;
  imageDescription?: string;
  pdfWidth?: Number;
  width?: string;
  height?: string;
  border?: boolean;

  coversheet?: HelpTextSection[];
  content?: HelpTextSection[];
  subsections?: HelpTextSection[];
  steps?: HelpTextStep[];

  constructor() {
    this.id = createHelpNodeId();
  }

  private get collections(): SectionCollections {
    return new SectionCollections(() => [this.content, this.subsections, this.coversheet]);
  }

  public getTranslationKey(): string | null {
    if (isValuelessContentType(this.type)) {
      return null;
    }

    if (isImageContentType(this.type)) {
      return this.imageDescription;
    }

    return this.value || null;
  }

  hasChildren(): boolean {
    return !!(
      (this.content && this.content.length > 0) ||
      (this.subsections && this.subsections.length > 0) ||
      (this.steps && this.steps.length > 0)
    );
  }

  public findSectionById(contentId: string): HelpTextSection | null {
    const foundInCollections = this.collections.findSectionById(contentId);
    if (foundInCollections) {
      return foundInCollections;
    }

    const foundStep = findStepById(this.steps, contentId);
    if (foundStep) {
      return foundStep as unknown as HelpTextSection;
    }

    return null;
  }

  public findParentOfSectionById(contentId: string): HelpTextSection | null {
    const foundParent = this.collections.findParentOfSectionById(contentId, this);
    if (foundParent) {
      return foundParent;
    }

    if (findStepById(this.steps, contentId)) {
      return this;
    }

    return null;
  }

  public removeId(contentId: string): boolean {
    const removedFromSteps = removeStepById(this.steps, contentId);
    if (removedFromSteps) {
      return true;
    }

    return this.collections.removeId(contentId);
  }

  public addSubsection(contentId: string, index: number = -1): HelpTextSection {
    if (!this.subsections) {
      this.subsections = [];
    }

    const newItem = new HelpTextSection;
    newItem.value = contentId;
    newItem.id = contentId;

    if (index === -1 || index > this.subsections.length) {
      this.subsections.push(newItem);
    } else {
      this.subsections.splice(index, 0, newItem);
    }

    return newItem;
  }

  public addSubsectionAfter(contentId: string, afterSectionId: string): HelpTextSection {
    if (!this.subsections || this.subsections.length === 0) {
      return this.addSubsection(contentId);
    }

    const currentIndex = this.subsections.findIndex(section => matchesSectionId(section, afterSectionId));
    const insertIndex = currentIndex === -1 ? this.subsections.length : currentIndex + 1;
    return this.addSubsection(contentId, insertIndex);
  }

  public addStep(contentId: string) {
    if (isEnumerationContentType(this.type)) {
      const newStep = new HelpTextStep;
      newStep.value = contentId;
      newStep.id = contentId;
      if (!this.steps) {
        this.steps = [];
      }
      this.steps.push(newStep);
    }
  }

  public changeValueId(oldId: string, newId: string): boolean {
    const changedInSteps = changeStepValueId(this.steps, oldId, newId);
    if (changedInSteps) {
      return true;
    }

    return this.collections.changeValueId(oldId, newId);
  }

  public getIndexOfId(contentId: string): number {
    let idx = 0;

    if (this.content) {
      for (const item of this.content) {
        idx += 1;
        if (item.value === contentId) {
          return idx;
        }
      }
    }
    return -1;
  }

  public idExists(key: string): boolean {
    const existsInCollections = this.collections.idExists(key);
    const existsInSteps = stepIdExists(this.steps, key);
    const existsInImageDescription = this.imageDescription === key;
    const existsInTable = isTableSection(this) && (this as unknown as HelpTextTable).idExists(key);

    return !!(existsInCollections || existsInSteps || existsInImageDescription || existsInTable);
  }
}


export interface TableCellImage {
  type: HelpContentType.IMAGE;
  value: string;
  imageDescription?: string;
  width?: string;
  height?: string;
  border?: boolean;
}

export type TableCellValue = string | TableCellImage;

export interface RowItem {
  rowValues: TableCellValue[];
}

export interface TableCellSelection {
  tableId: string;
  rowIndex?: number;
  colIndex: number;
  isHeader: boolean;
  key?: string | null;
}

export function isTableCellImage(cell?: TableCellValue | null): cell is TableCellImage {
  return !!cell && typeof cell === 'object' && (cell as TableCellImage).type === HelpContentType.IMAGE;
}

export function getTableCellKey(cell?: TableCellValue | null): string | null {
  if (!cell) {
    return null;
  }
  if (typeof cell === 'string') {
    return cell;
  }
  return cell.imageDescription || null;
}

export class HelpTextTable extends HelpTextSection {
  header: TableCellValue[] = [];
  rows?: RowItem[];

  public idExists(key: string): boolean {
    for (const headerItem of this.header ?? []) {
      if (getTableCellKey(headerItem) === key) {
        return true;
      }
    }

    if (this.rows) {
      for (const row of this.rows) {
        for (const rowItem of row.rowValues) {
          if (getTableCellKey(rowItem) === key) {
            return true;
          }
        }
      }
    }

    return false;
  }
}

export interface AbbreviationItem {
  abbreviation: string;
  shortDescription: string;
  longDescription: string;
  referenceAbbreviation?: string;
}

export class MainHelpSection {
  coversheet?: HelpTextSection[];
  abbreviations?: AbbreviationItem[];
  content?: HelpTextSection[];

  private get collections(): SectionCollections {
    return new SectionCollections(() => [this.coversheet, this.content]);
  }

  public addSection(contentId: string, index: number = -1): HelpTextSection {
    if (!this.content) {
      this.content = [];
    }

    const newSection = new HelpTextSection();
    newSection.linkId = '';
    newSection.value = contentId;
    newSection.id = contentId;

    if (index === -1) {
      this.content.push(newSection);
    } else {
      this.content.splice(index, 0, newSection);
    }

    return newSection;
  }

  public findSectionById(contentId: string): HelpTextSection | null {
    return this.collections.findSectionById(contentId);
  }

  public findParentOfSectionById(contentId: string): HelpTextSection | null {
    return this.collections.findParentOfSectionById(contentId, null);
  }

  public changeValueId(oldId: string, newId: string): boolean {
    return this.collections.changeValueId(oldId, newId);
  }

  public idExists(key: string): boolean {
    const existsInSections = this.collections.idExists(key);
    const existsInAbbreviations = (this.abbreviations || []).some(item =>
      item.abbreviation === key || item.longDescription === key || item.shortDescription === key
    );

    return existsInSections || existsInAbbreviations;
  }
}

export class HelpTextRoot {
  [key: string]: unknown;
  private standaloneSections?: HelpTextSection[];
  private format: HelpTextRootFormat = 'keyed';

  constructor(initialSections: Partial<Record<HelpTextRootKey, MainHelpSection>> = {}) {
    Object.assign(this, initialSections);
  }

  public getSectionKeys(): HelpTextRootKey[] {
    const keys = Object.keys(this).filter(key => this.getSection(key) instanceof MainHelpSection);
    const knownKeys = HELP_TEXT_ROOT_KEYS.filter(key => keys.includes(key));
    const extraKeys = keys.filter(key => !HELP_TEXT_ROOT_KEYS.includes(key));
    return [...knownKeys, ...extraKeys];
  }

  public getSections(): MainHelpSection[] {
    return this.getSectionKeys()
      .map(key => this.getSection(key) as MainHelpSection)
      .filter((section): section is MainHelpSection => !!section);
  }

  public getSection(key: HelpTextRootKey): MainHelpSection | undefined {
    return (this as any)[key] as MainHelpSection;
  }

  public setSection(key: HelpTextRootKey, section: MainHelpSection | null | undefined): void {
    if (!section) {
      delete (this as any)[key];
      return;
    }

    (this as any)[key] = section;
    if (key === STANDALONE_SECTION_KEY && section.content) {
      this.setStandaloneSections(section.content, this.format === 'standalone-array' ? 'standalone-array' : 'standalone-content');
    }
  }

  public setStandaloneSections(sections: HelpTextSection[], format: HelpTextRootFormat = 'standalone-content'): void {
    this.standaloneSections = sections;
    this.format = format;
  }

  public getStandaloneSections(): HelpTextSection[] | undefined {
    return this.standaloneSections;
  }

  public getFormat(): HelpTextRootFormat {
    return this.format;
  }

  public isStandalone(): boolean {
    return this.format !== 'keyed';
  }

  public forEachSection(handler: (section: MainHelpSection, key: HelpTextRootKey) => void): void {
    this.getSectionKeys().forEach(key => {
      const section = this.getSection(key);
      if (section) {
        handler(section, key);
      }
    });
  }

  public idExists(key: string): boolean {
    const existsInMainSections = this.getSections().some(section => section?.idExists(key));
    if (existsInMainSections) {
      return true;
    }

    if (this.standaloneSections?.length) {
      return this.standaloneSections.some(section => section?.idExists(key));
    }

    return false;
  }
}

function findSectionInCollections(collections: SectionCollection[], contentId: string): HelpTextSection | null {
  for (const collection of collections) {
    if (!collection) { continue; }

    for (const section of collection) {
      if (!section) { continue; }
      if (matchesSectionId(section, contentId)) {
        return section;
      }
      if (isTableSection(section)) {
        const tableSection = section as HelpTextTable;
        if (tableSection.header?.some(cell => getTableCellKey(cell) === contentId)) {
          return tableSection;
        }
        if (tableSection.rows?.some(row => row.rowValues?.some(cell => getTableCellKey(cell) === contentId))) {
          return tableSection;
        }
      }

      const found = section.findSectionById(contentId);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

function findParentInCollections(
  collections: SectionCollection[],
  contentId: string,
  directParent: HelpTextSection | null
): HelpTextSection | null {
  for (const collection of collections) {
    if (!collection) { continue; }

    for (const section of collection) {
      if (!section) { continue; }
      if (matchesSectionId(section, contentId)) {
        return directParent;
      }
      if (isTableSection(section)) {
        const tableSection = section as HelpTextTable;
        if (tableSection.header?.some(cell => getTableCellKey(cell) === contentId)
          || tableSection.rows?.some(row => row.rowValues?.some(cell => getTableCellKey(cell) === contentId))) {
          return section;
        }
      }

      if (stepIdExists(section.steps, contentId)) {
        return section;
      }

      const childCollections: SectionCollection[] = [section.content, section.subsections, section.coversheet];
      const found = findParentInCollections(childCollections, contentId, section);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

function changeValueIdInCollections(collections: SectionCollection[], oldId: string, newId: string): boolean {
  for (const collection of collections) {
    if (!collection) { continue; }

    for (const section of collection) {
      if (section.value === oldId) {
        section.value = newId;
        if (section.id === oldId) {
          section.id = newId;
        }
        return true;
      }

      const changed = section.changeValueId(oldId, newId);
      if (changed) {
        return true;
      }
    }
  }

  return false;
}

function idExistsInCollections(collections: SectionCollection[], key: string): boolean {
  for (const collection of collections) {
    if (!collection) { continue; }

    for (const section of collection) {
      if (section.value === key) {
        return true;
      }

      const exists = section.idExists(key);
      if (exists) {
        return true;
      }
    }
  }

  return false;
}

function removeFromCollections(collections: SectionCollection[], contentId: string): boolean {
  for (const collection of collections) {
    if (!collection) { continue; }

    const index = collection.findIndex(item => item && matchesSectionId(item, contentId));
    if (index !== -1) {
      collection.splice(index, 1);
      return true;
    }

    for (const section of collection) {
      if (!section) { continue; }
      if (section.removeId(contentId)) {
        return true;
      }
    }
  }

  return false;
}

function matchesStepId(step: HelpTextStep, contentId: string): boolean {
  return step.id === contentId || step.value === contentId;
}

function findStepById(steps: HelpTextStep[] | undefined, contentId: string): HelpTextStep | null {
  if (!steps) {
    return null;
  }

  for (const step of steps) {
    if (matchesStepId(step, contentId)) {
      return step;
    }

    const found = findStepById(step.substeps, contentId);
    if (found) {
      return found;
    }
  }

  return null;
}

function removeStepById(steps: HelpTextStep[] | undefined, contentId: string): boolean {
  if (!steps) {
    return false;
  }

  const index = steps.findIndex(step => matchesStepId(step, contentId));
  if (index !== -1) {
    steps.splice(index, 1);
    return true;
  }

  return steps.some(step => removeStepById(step.substeps, contentId));
}

function changeStepValueId(steps: HelpTextStep[] | undefined, oldId: string, newId: string): boolean {
  if (!steps) {
    return false;
  }

  for (const step of steps) {
    if (step.value === oldId) {
      step.value = newId;
      if (step.id === oldId) {
        step.id = newId;
      }
      return true;
    }
    if (changeStepValueId(step.substeps, oldId, newId)) {
      return true;
    }
  }

  return false;
}

function stepIdExists(steps: HelpTextStep[] | undefined, key: string): boolean {
  if (!steps) {
    return false;
  }

  return steps.some(step => matchesStepId(step, key) || stepIdExists(step.substeps, key));
}

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

const VALUELESS_CONTENT_TYPES = new Set<HelpContentType>([
  HelpContentType.ENUMERATION,
  HelpContentType.BULLET_ENUMERATION,
  HelpContentType.TABLE,
]);

const INTERNAL_ID_KEY = '__internalId';
let internalIdCounter = 0;

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

export function isNonNestableType(type?: string): boolean {
  if (!type) {
    return false;
  }

  return NON_NESTABLE_CONTENT_TYPES.has(type as HelpContentType);
}

export function isValuelessContentType(type?: string): boolean {
  if (!type) {
    return false;
  }

  return VALUELESS_CONTENT_TYPES.has(type as HelpContentType);
}

export function getSectionSelectionId(section?: HelpTextSection | HelpTextStep | null): string | null {
  if (!section) {
    return null;
  }

  if ((section as HelpTextStep).type === 'STEP') {
    return (section as HelpTextStep).value || null;
  }

  if ((section as HelpTextSection).value) {
    return (section as HelpTextSection).value;
  }

  return ensureInternalId(section as HelpTextSection);
}

export function matchesSectionId(section: HelpTextSection, contentId: string): boolean {
  if (!contentId) {
    return false;
  }

  return section.value === contentId || (section as any)[INTERNAL_ID_KEY] === contentId;
}

function ensureInternalId(section: HelpTextSection): string {
  const existing = (section as any)[INTERNAL_ID_KEY];
  if (existing) {
    return existing;
  }

  internalIdCounter += 1;
  const id = `section-${internalIdCounter}`;
  Object.defineProperty(section, INTERNAL_ID_KEY, {
    value: id,
    enumerable: false,
    writable: false
  });
  return id;
}

export const HELP_TEXT_ROOT_KEYS = [
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
] as const;

export type HelpTextRootKey = typeof HELP_TEXT_ROOT_KEYS[number];

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
  value: string;
  type = 'STEP';
  substeps?: HelpTextStep[];

  public getTranslationKey(): string {
    return this.value;
  }
}

export class HelpTextSection {
  linkId: string;
  value: string; // Key, der in der QTF-Übersetzung steht
  type: string;
  imageDescription?: string;
  pdfWidth?: Number;
  width?: string;
  border?: boolean;

  coversheet?: HelpTextSection[];
  content?: HelpTextSection[];
  subsections?: HelpTextSection[];
  steps?: HelpTextStep[];

  private get collections(): SectionCollections {
    return new SectionCollections(() => [this.content, this.subsections, this.coversheet]);
  }

  public getTranslationKey(): string | null {
    if (isValuelessContentType(this.type)) {
      return null;
    }

    if (this.type === 'IMAGE' || this.type === 'SPLITIMAGE') {
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
    if (this.type === HelpContentType.ENUMERATION || this.type === HelpContentType.BULLET_ENUMERATION) {
      const newStep = new HelpTextStep;
      newStep.value = contentId;
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
    const existsInTable = this.type === 'TABLE' && (this as unknown as HelpTextTable).idExists(key);

    return !!(existsInCollections || existsInSteps || existsInImageDescription || existsInTable);
  }
}


export interface TableCellImage {
  type: 'IMAGE';
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
  return !!cell && typeof cell === 'object' && (cell as TableCellImage).type === 'IMAGE';
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
    for (const headerItem of this.header) {
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

  constructor(initialSections: Partial<Record<HelpTextRootKey, MainHelpSection>> = {}) {
    Object.assign(this, initialSections);
  }

  public getSectionKeys(): HelpTextRootKey[] {
    return HELP_TEXT_ROOT_KEYS.filter(key => !!(this as any)[key]);
  }

  public getSections(): MainHelpSection[] {
    return this.getSectionKeys()
      .map(key => (this as any)[key] as MainHelpSection)
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
    return this.getSections().some(section => section?.idExists(key));
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
      if (section.type === 'TABLE') {
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
      if (section.type === 'TABLE') {
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

function findStepById(steps: HelpTextStep[] | undefined, contentId: string): HelpTextStep | null {
  if (!steps) {
    return null;
  }

  for (const step of steps) {
    if (step.value === contentId) {
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

  const index = steps.findIndex(step => step.value === contentId);
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

  return steps.some(step => step.value === key || stepIdExists(step.substeps, key));
}


export function parseHelpTextRoot(json: any): HelpTextRoot {
  const root = new HelpTextRoot();

  HELP_TEXT_ROOT_KEYS.forEach(key => {
    if (json && json[key]) {
      root.setSection(key, parseMainHelpSection(json[key]));
    }
  });

  return root;
}

export function serializeHelpTextRoot(root: HelpTextRoot): Record<HelpTextRootKey, unknown> {
  const serialized: Partial<Record<HelpTextRootKey, unknown>> = {};

  root.forEachSection((section, key) => {
    serialized[key] = serializeMainHelpSection(section);
  });

  return serialized as Record<HelpTextRootKey, unknown>;
}

export function serializeMainHelpSection(section: MainHelpSection): Record<string, unknown> {
  const serialized: Record<string, unknown> = {};

  if (section.coversheet?.length) {
    serialized.coversheet = section.coversheet.map(serializeHelpTextSection);
  }
  if (section.abbreviations?.length) {
    serialized.abbreviations = section.abbreviations.map(abbr => ({
      abbreviation: abbr.abbreviation,
      shortDescription: abbr.shortDescription,
      longDescription: abbr.longDescription,
      referenceAbbreviation: abbr.referenceAbbreviation
    }));
  }
  if (section.content?.length) {
    serialized.content = section.content.map(serializeHelpTextSection);
  }

  return serialized;
}

export function serializeHelpTextSection(section: HelpTextSection): Record<string, unknown> {
  if (section.type === 'TABLE') {
    return serializeHelpTextTable(section as HelpTextTable);
  }

  const serialized: Record<string, unknown> = {
    linkId: section.linkId,
    value: section.value,
    type: section.type
  };

  if (section.imageDescription !== undefined) {
    serialized.imageDescription = section.imageDescription;
  }
  if (section.pdfWidth !== undefined) {
    serialized.pdfWidth = section.pdfWidth;
  }
  if (section.width !== undefined) {
    serialized.width = section.width;
  }
  if (section.type === HelpContentType.IMAGE || section.type === HelpContentType.SPLITIMAGE) {
    serialized.border = !!section.border;
  }

  if (section.coversheet?.length) {
    serialized.coversheet = section.coversheet.map(serializeHelpTextSection);
  }
  if (section.content?.length) {
    serialized.content = section.content.map(serializeHelpTextSection);
  }
  if (section.subsections?.length) {
    serialized.subsections = section.subsections.map(serializeHelpTextSection);
  }
  if (section.steps?.length) {
    serialized.steps = section.steps.map(serializeHelpTextStep);
  }

  return serialized;
}

export function serializeHelpTextStep(step: HelpTextStep): Record<string, unknown> {
  const serialized: Record<string, unknown> = {
    value: step.value
  };

  if (step.substeps?.length) {
    serialized.substeps = step.substeps.map(serializeHelpTextStep);
  }

  return serialized;
}

export function serializeHelpTextTable(section: HelpTextTable): Record<string, unknown> {
  return {
    header: section.header,
    type: section.type,
    rows: section.rows
  };
}

export function parseMainHelpSection(obj: any): MainHelpSection {
  const item = new MainHelpSection();

  // coversheet is an array of sections
  if (obj.coversheet) {
    item.coversheet = obj.coversheet.map(parseHelpTextSection);
  }

  // abbreviations is an array of AbbreviationItem
  if (obj.abbreviations) {
    item.abbreviations = obj.abbreviations.map((abbr: any) => ({
      abbreviation: abbr.abbreviation,
      shortDescription: abbr.shortDescription,
      longDescription: abbr.longDescription,
      referenceAbbreviation: abbr.referenceAbbreviation
    }));
  }

  // content is an array of sections
  if (obj.content) {
    item.content = obj.content.map(parseHelpTextSection);
  }

  return item;
}

export function parseHelpTextSection(obj: any): HelpTextSection {
  if (obj.type === 'TABLE') {
    return parseHelpTextTable(obj);
  }

  const sec = new HelpTextSection();
  sec.linkId = obj.linkId;
  sec.value = obj.value;
  sec.type = obj.type;
  sec.imageDescription = obj.imageDescription;
  sec.pdfWidth = obj.pdfWidth;
  sec.width = obj.width;
  sec.border = !!obj.border;

  if (isValuelessContentType(sec.type)) {
    sec.value = undefined;
    ensureInternalId(sec);
  }

  if (((!sec.type) || (sec.type === '')) && (!sec.linkId || sec.linkId === '')) {
    console.error('JSON error. Section link ID is undefined or empty. Section value: ', sec.value);
  }

  /*if (obj.type == "IMAGE") {
    console.log("Image found. Value: ", obj.value, " in ", );
  }*/

  // If there's a "coversheet" array, parse them as nested HelpTextSection
  if (obj.coversheet) {
    sec.coversheet = obj.coversheet.map(parseHelpTextSection);
  }
  // If there's a "content" array, parse them
  if (obj.content) {
    sec.content = obj.content.map(parseHelpTextSection);
  }
  // If there's a "subsections" array, parse them
  if (obj.subsections) {
    sec.subsections = obj.subsections.map(parseHelpTextSection);
  }
  // If there's a "steps" array, parse them
  if (obj.steps) {
    sec.steps = obj.steps.map(parseHelpTextStep);
  }

  return sec;
}

export function parseHelpTextStep(step: any): HelpTextStep {
  const newStep = new HelpTextStep();
  newStep.value = step.value;
  newStep.substeps = step.substeps ? step.substeps.map(parseHelpTextStep) : undefined;
  return newStep;
}

export function parseHelpTextTable(obj: any): HelpTextTable {
  const newTable = new HelpTextTable();

  newTable.type = obj.type;
  newTable.header = obj.header;
  newTable.rows = obj.rows;
  newTable.linkId = undefined;
  newTable.value = undefined;
  newTable.content = undefined;
  newTable.steps = undefined;
  newTable.subsections = undefined;
  ensureInternalId(newTable);

  return newTable;
}

export function collectStructureIssues(root: HelpTextRoot | null | undefined): StructureIssue[] {
  if (!root) {
    return [];
  }

  const issues: StructureIssue[] = [];

  const addIssue = (section: HelpTextSection, invalidContainers: string[]) => {
    const displayKey = section.imageDescription || section.value || section.linkId || 'unknown';
    const typeLabel = section.type || 'unknown';
    issues.push({
      sectionKey: displayKey,
      message: `Element vom Typ ${typeLabel} darf keine Unterelemente besitzen (gefunden: ${invalidContainers.join(', ')}).`
    });
  };

  const collectSectionIssues = (section?: HelpTextSection) => {
    if (!section) {
      return;
    }

    if (isNonNestableType(section.type)) {
      const invalidContainers = [];
      if (section.coversheet?.length) {
        invalidContainers.push('coversheet');
      }
      if (section.content?.length) {
        invalidContainers.push('content');
      }
      if (section.subsections?.length) {
        invalidContainers.push('subsections');
      }
      if (section.steps?.length) {
        invalidContainers.push('steps');
      }
      if (invalidContainers.length > 0) {
        addIssue(section, invalidContainers);
      }
    }

    section.coversheet?.forEach(collectSectionIssues);
    section.content?.forEach(collectSectionIssues);
    section.subsections?.forEach(collectSectionIssues);
  };

  root.getSections().forEach(mainSection => {
    mainSection?.coversheet?.forEach(collectSectionIssues);
    mainSection?.content?.forEach(collectSectionIssues);
  });

  return issues;
}

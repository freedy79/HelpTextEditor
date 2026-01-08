import {
  HELP_TEXT_ROOT_KEYS,
  HelpContentType,
  HelpTextRoot,
  HelpTextRootKey,
  MainHelpSection,
  HelpTextSection,
  HelpTextStep,
  HelpTextTable,
  createHelpNodeId,
  isImageContentType,
  isTableContentType,
  isTableSection,
  isValuelessContentType
} from './help-text-structure.model';

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
  if (isTableSection(section)) {
    return serializeHelpTextTable(section as HelpTextTable);
  }

  const serialized: Record<string, unknown> = {
    id: section.id,
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
  if (section.height !== undefined) {
    serialized.height = section.height;
  }
  if (isImageContentType(section.type)) {
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
    id: step.id,
    value: step.value
  };

  if (step.substeps?.length) {
    serialized.substeps = step.substeps.map(serializeHelpTextStep);
  }

  return serialized;
}

export function serializeHelpTextTable(section: HelpTextTable): Record<string, unknown> {
  return {
    id: section.id,
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
  const type = obj?.type as HelpContentType;
  if (isTableContentType(type)) {
    return parseHelpTextTable(obj);
  }

  const sec = new HelpTextSection();
  sec.linkId = obj.linkId;
  sec.value = obj.value;
  sec.type = type;
  sec.imageDescription = obj.imageDescription;
  sec.pdfWidth = obj.pdfWidth;
  sec.width = obj.width;
  sec.height = obj.height;
  sec.border = !!obj.border;

  sec.id = obj.id ?? (typeof sec.value === 'string' ? createHelpNodeId(sec.value) : sec.id);

  if (isValuelessContentType(sec.type)) {
    sec.value = undefined;
    sec.id = obj.id ?? sec.id;
  }

  if (!sec.type && !sec.linkId) {
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
  newStep.id = step.id ?? (typeof newStep.value === 'string' ? createHelpNodeId(newStep.value) : newStep.id);
  newStep.substeps = step.substeps ? step.substeps.map(parseHelpTextStep) : undefined;
  return newStep;
}

export function parseHelpTextTable(obj: any): HelpTextTable {
  const newTable = new HelpTextTable();

  newTable.type = HelpContentType.TABLE;
  newTable.header = Array.isArray(obj?.header) ? obj.header : [];
  newTable.rows = Array.isArray(obj?.rows)
    ? obj.rows.map((row: any) => ({
      rowValues: Array.isArray(row?.rowValues) ? row.rowValues : []
    }))
    : [];
  normalizeTableStructure(newTable);
  newTable.linkId = undefined;
  newTable.value = undefined;
  newTable.content = undefined;
  newTable.steps = undefined;
  newTable.subsections = undefined;
  newTable.id = obj.id ?? newTable.id;

  return newTable;
}

function normalizeTableStructure(table: HelpTextTable): void {
  if (!Array.isArray(table.header)) {
    table.header = [];
  }

  if (!Array.isArray(table.rows)) {
    table.rows = [];
  }

  for (const row of table.rows) {
    if (!Array.isArray(row.rowValues)) {
      row.rowValues = [];
    }
  }
}

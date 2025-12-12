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

export class HelpTextRoot {
  HELP_TEXT_DEVICE_CONCEPT?: MainHelpSection;
  HELP_TEXT_TASKS_CONCEPT?: MainHelpSection;
  HELP_TEXT_PRINT_CONCEPT?: MainHelpSection;
  HELP_TEXT_USER_MANAGEMENT?: MainHelpSection;
  HELP_TEXT_NETWORK_CONNECTION?: MainHelpSection;
  HELP_TEXT_WEIGHING_FUNCTION?: MainHelpSection;
  HELP_TEXT_TIMER_CNTRL_ACTION?: MainHelpSection;
  HELP_TEXT_DEVICE_CLEANING?: MainHelpSection;
  HELP_TEXT_DEVICE_MAINTENANCE?: MainHelpSection;
  HELP_TEXT_JOB_MANAGEMENT?: MainHelpSection;
  // ... ggf. weitere 

  public idExists(key: string): boolean {
    if (this.idExistsInMainHelpSection(this.HELP_TEXT_DEVICE_CONCEPT, key)) {
      return true;
    }
    if (this.idExistsInMainHelpSection(this.HELP_TEXT_TASKS_CONCEPT, key)) {
      return true;
    }
    if (this.idExistsInMainHelpSection(this.HELP_TEXT_PRINT_CONCEPT, key)) {
      return true;
    }
    if (this.idExistsInMainHelpSection(this.HELP_TEXT_USER_MANAGEMENT, key)) {
      return true;
    }
    if (this.idExistsInMainHelpSection(this.HELP_TEXT_NETWORK_CONNECTION, key)) {
      return true;
    }
    if (this.idExistsInMainHelpSection(this.HELP_TEXT_WEIGHING_FUNCTION, key)) {
      return true;
    }
    if (this.idExistsInMainHelpSection(this.HELP_TEXT_TIMER_CNTRL_ACTION, key)) {
      return true;
    }
    if (this.idExistsInMainHelpSection(this.HELP_TEXT_DEVICE_CLEANING, key)) {
      return true;
    }
    if (this.idExistsInMainHelpSection(this.HELP_TEXT_DEVICE_MAINTENANCE, key)) {
      return true;
    }
    if (this.idExistsInMainHelpSection(this.HELP_TEXT_JOB_MANAGEMENT, key)) {
      return true;
    }

    return false;
  }

  private idExistsInMainHelpSection(main: MainHelpSection, key: string) {
    let exists: boolean = false;
    if (main) {
      exists = main.idExists(key);
      if (exists) {
        return exists;
      }
    }
  }
}

export type HelpTextRootKey = keyof typeof HelpTextRoot;

export class MainHelpSection {
  coversheet?: HelpTextSection[];
  abbreviations?: AbbreviationItem[];
  content?: HelpTextSection[];

  public addSection(contentId: string, index: number = -1): HelpTextSection {
    if (!this.content) {
      this.content = [];
    }

    var newSection: HelpTextSection = new HelpTextSection;
    newSection.linkId = "";
    newSection.value = contentId;

    if (index == -1) {
      this.content.push(newSection);
    } else {
      this.content.splice(index, 0, newSection);
    }

    return newSection;
  }

  public findSectionById(contentId: string): HelpTextSection {
    //console.log("searching ", contentId);

    if (this.content) {
      for (const section of this.content) {
        //console.log("found: ", section.value);
        if (section.value === contentId) {
          return section;
        }
        // Potentially, also traverse child subsections or content
        //console.log("searching in subsection...");
        const foundInSub = section.findSectionById(contentId);
        if (foundInSub) {
          return foundInSub;
        }
      }
    }

    if (this.coversheet) {
      for (const section of this.coversheet) {
        //console.log("found: ", section.value);
        if (section.value === contentId) {
          return section;
        }
        // Potentially, also traverse child subsections or content
        //console.log("searching in subsection...");
        const foundInSub = section.findSectionById(contentId);
        if (foundInSub) {
          return foundInSub;
        }
      }
    }

    return null;
  }

  public findParentOfSectionById(contentId: string): HelpTextSection {
    if (this.content) {
      //console.log("searching in content");
      for (const section of this.content) {
        if (section.value == contentId) {
          console.log("Part of content");
          return null;
        }
        // console.log("found: ", section.value);

        let foundInContent = section.findParentOfSectionById(contentId);
        if (foundInContent) {
          return foundInContent;
        }
      }
    }


    if (this.coversheet) {
      //console.log("searching in coversheet");
      for (const section of this.coversheet) {
        if (section.value == contentId) {
          console.log("Part of coversheet");
          return null;
        }

        let foundInContent = section.findParentOfSectionById(contentId);
        if (foundInContent) {
          return foundInContent;
        }
      }
    }

    console.error(contentId, " not found in ", JSON.stringify(this));

    return null;
  }

  public changeValueId(oldId: string, newId: string): boolean {
    if (this.content) {
      for (const section of this.content) {
        //console.log("found: ", section.value);
        if (section.value === oldId) {
          section.value = newId;
          return true;
        }
        // Potentially, also traverse child subsections or content
        //console.log("searching in subsection...");
        const changedInSub = section.changeValueId(oldId, newId);
        if (changedInSub) {
          return changedInSub;
        }
      }
    }

    if (this.coversheet) {
      for (const section of this.coversheet) {
        //console.log("found: ", section.value);
        if (section.value === oldId) {
          section.value = newId;
          return true;
        }
        // Potentially, also traverse child subsections or content
        //console.log("searching in subsection...");
        const foundInSub = section.changeValueId(oldId, newId);
        if (foundInSub) {
          return foundInSub;
        }
      }
    }

    return false;
  }

  public idExists(key: string): boolean {
    if (this.content) {
      for (const section of this.content) {
        //console.log("found: ", section.value);
        if (section.value === key) {
          return true;
        }
        // Potentially, also traverse child subsections or content
        //console.log("searching in subsection...");
        const exists = section.idExists(key);
        if (exists) {
          return exists;
        }
      }
    }

    if (this.coversheet) {
      for (const section of this.coversheet) {
        //console.log("found: ", section.value);
        if (section.value === key) {
          return true;
        }
        // Potentially, also traverse child subsections or content
        //console.log("searching in subsection...");
        const exists = section.idExists(key);
        if (exists) {
          return exists;
        }
      }
    }

    if (this.abbreviations) {
      for (const item of this.abbreviations) {
        //console.log("found: ", section.value);
        if ((item.abbreviation === key) || (item.longDescription === key) || (item.shortDescription === key)) {
          return true;
        }
      }
    }

    return false;
  }
}


export class HelpTextSection {
  linkId: string;
  value: string; // Key, der in der QTF-Übersetzung steht
  type: string;
  imageDescription?: string;
  pdfWidth?: Number;
  width?: string;

  coversheet?: HelpTextSection[];
  content?: HelpTextSection[];
  subsections?: HelpTextSection[];
  steps?: HelpTextStep[];

  public getTranslationKey(): string {
    if (this.type) {
      if (this.type == "IMAGE" || this.type == "SPLITIMAGE") {
        return this.imageDescription;
      }
    }

    return this.value;
  }

  hasChildren(): boolean {
    if (this.content) {
      return this.content.length > 0;
    }
    if (this.subsections) {
      return this.subsections.length > 0;
    } else if (this.steps) {
      return this.steps.length > 0;
    }
  }

  public findSectionById(contentId: string): HelpTextSection {
    // Check direct content first
    if (this.content) {
      for (const item of this.content) {
        if (item.value === contentId) {
          return item;
        }
        if (item.type === "TABLE") {
          //console.log("table found. ");
          const tableItem = (item as HelpTextTable);
          if (tableItem.header && tableItem.header.length > 0) {
            if (tableItem.header.indexOf(contentId) > -1) {
              return tableItem;
            }
          }
          
          if (tableItem.rows && tableItem.rows.length > 0) {
            for (const row of tableItem.rows) {
              const idx = row.rowValues.indexOf(contentId);
              if (idx > -1) {
                return tableItem;
              }
            }
          }
        }
        
        const found = item.findSectionById(contentId);
        if (found) {
          return found;
        }
      }
    }
    if (this.steps) {
      for (const item of this.steps) {
        if (item.value === contentId) {
          //console.log("contentId is step");
          return item as HelpTextSection;
        }

        const foundStep = this.findStepById(item.substeps, contentId);
        if (foundStep) {
          return foundStep as HelpTextSection;
        }
      }
    }

    // Also search subsections
    if (this.subsections) {
      for (const sub of this.subsections) {
        if (sub.value === contentId) {
          return sub;
        }
        const found = sub.findSectionById(contentId);
        if (found) {
          return found;
        }
      }
    }
    // Also coversheet
    if (this.coversheet) {
      for (const cs of this.coversheet) {
        if (cs.value === contentId) {
          return cs;
        }
        const found = cs.findSectionById(contentId);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  public findParentOfSectionById(contentId: string): HelpTextSection {
    //console.log("findParentOfSectionById: trying to find ", contentId, " in ", this.value);

    if (this.content) {
      for (const section of this.content) {
        //console.log("findParentOfSectionById: current section: ", section.value);
        if (section.value === contentId) {
          return this;
        }

        if (section.subsections) {
          //console.log("searching in subsection of ", this.value);
          for (const sub of section.subsections) {
            if (sub.value === contentId) {
              return sub;
            }
            const found = sub.findParentOfSectionById(contentId);
            if (found) {
              return found;
            }
          }
        }

        if (section.steps) {
          //console.log("Check steps of ", section.value);
          for (const step of section.steps) {
            if (this.stepIdExists(step, contentId)) {
              return section;
            }
          }
        }
      }
    }

    if (this.steps) {
      for (const step of this.steps) {
        if (this.stepIdExists(step, contentId)) {
          return this;
        }
      }
    }

    if (this.subsections) {
      //console.log("look in subsections ");
      for (const sub of this.subsections) {
        //console.log("   subsection: ", sub.value);
        if (sub.value === contentId) {
          //console.log("return subsection: ", this.value);
          return this;
        }
        const found = sub.findParentOfSectionById(contentId);
        if (found) {
          //console.log("found ", found.value);
          return found;
        }
      }
    }

    return null;
  }

  public removeId(contentId: string): boolean {
    //console.log("remove in ", this.value);
    if (this.content) {
      for (const section of this.content) {
        if (section.value === contentId) {
          //console.log("removeId: ", section.value);
          this.content = this.content.filter(item => item.value !== contentId);
          return true;
        }
      }
    }

    if (this.steps) {
      console.log("checking in steps");
      if (this.removeStepById(this.steps, contentId)) {
        return true;
      }
    }

    if (this.subsections) {
      for (const section of this.subsections) {
        if (section.value === contentId) {
          //console.log("removeId: ", section.value);
          this.subsections = this.subsections.filter(item => item.value !== contentId);
          return true;
        }
      }
    }
    console.error("Could not remove. Wrong parent? ", JSON.stringify(this));
    return false;
  }

  private removeStepById(steps: HelpTextStep[], contentId: string): boolean {
    const index = steps.findIndex(step => step.value === contentId);
    if (index !== -1) {
      steps.splice(index, 1);
      return true;
    }

    for (const step of steps) {
      if (step.substeps && this.removeStepById(step.substeps, contentId)) {
        return true;
      }
    }

    return false;
  }

  public addSubsection(contentId: string): HelpTextSection {
    if (!this.subsections) {
      this.subsections = [];
    }

    var newItem = new HelpTextSection;
    newItem.value = contentId;
    this.subsections.push(newItem);

    return newItem;
  }

  public addStep(contentId: string) {
    if (this.type == HelpContentType.ENUMERATION || this.type == HelpContentType.BULLET_ENUMERATION) {
      let newStep = new HelpTextStep;
      newStep.value = contentId;
      if (!this.steps) {
        this.steps = [];
      }
      this.steps.push(newStep);
    }
  }

  public changeValueId(oldId: string, newId: string): boolean {
    if (this.content) {
      for (var item of this.content) {
        //console.log("changeValueId Item: ", item.value, " old: ", oldId, " new: ", newId);
        if (item.value === oldId) {
          item.value = newId;
          return true;
        }
        const found = item.changeValueId(oldId, newId);
        if (found) {
          return found;
        }
      }
    }
    if (this.steps) {
      for (var step of this.steps) {
        if (this.changeStepValueId(step, oldId, newId)) {
          return true;
        }
      }
    }
    if (this.subsections) {
      for (var subsection of this.subsections) {
        if (subsection.value == oldId) {
          subsection.value = newId;
          return true;
        }
        const found = subsection.changeValueId(oldId, newId);
        if (found) {
          return found;
        }
      }
    }
    return false;
  }

  public getIndexOfId(contentId: string): number {
    var idx = 0;

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
    if (this.content) {
      for (const section of this.content) {
        //console.log("found: ", section.value);
        if (section.value === key) {
          return true;
        }

        // Potentially, also traverse child subsections or content
        //console.log("searching in subsection...");
        const exists = section.idExists(key);
        if (exists) {
          return exists;
        }
      }
    }
    if (this.steps) {
      for (var step of this.steps) {
        if (this.stepIdExists(step, key)) {
          return true;
        }
      }
    }
    if (this.subsections) {
      for (var subsection of this.subsections) {
        if (subsection.value == key) {
          return true;
        }
        const found = subsection.idExists(key);
        if (found) {
          return found;
        }
      }
    }

    if (this.coversheet) {
      for (var cover of this.coversheet) {
        if (cover.value == key) {
          return true;
        }
        const found = cover.idExists(key);
        if (found) {
          return found;
        }
      }
    }

    if (this.imageDescription) {
      if (this.imageDescription === key) {
        return true;
      }
    }

    if (this.type == "TABLE") {
      if (((this as unknown) as HelpTextTable).idExists(key)) {
        return true;
      }
    }
  }

  private findStepById(steps: HelpTextStep[] | undefined, contentId: string): HelpTextStep | null {
    if (!steps) {
      return null;
    }

    for (const step of steps) {
      if (step.value === contentId) {
        return step;
      }

      const found = this.findStepById(step.substeps, contentId);
      if (found) {
        return found;
      }
    }

    return null;
  }

  private changeStepValueId(step: HelpTextStep, oldId: string, newId: string): boolean {
    if (step.value === oldId) {
      step.value = newId;
      return true;
    }

    if (step.substeps) {
      for (const substep of step.substeps) {
        if (this.changeStepValueId(substep, oldId, newId)) {
          return true;
        }
      }
    }

    return false;
  }

  private stepIdExists(step: HelpTextStep, key: string): boolean {
    if (step.value === key) {
      return true;
    }

    if (step.substeps) {
      for (const substep of step.substeps) {
        if (this.stepIdExists(substep, key)) {
          return true;
        }
      }
    }

    return false;
  }
}


export class HelpTextStep {
  value: string;
  type: string = "STEP";
  substeps?: HelpTextStep[];

  public getTranslationKey(): string {
    return this.value;
  }
}

export interface RowItem {
  rowValues: string[];
}

export class HelpTextTable extends HelpTextSection {
  header: string[] = [];
  rows?: RowItem[];

  public idExists(key: string): boolean {
    for (var headerItem of this.header) {
      if (headerItem === key) {
        return true;
      }
    }

    for (var row of this.rows) {
      for (var rowItem of row.rowValues) {
        if (rowItem === key) {
          return true;
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
}


export function parseHelpTextRoot(json: any): HelpTextRoot {
  const root = new HelpTextRoot();

  if (json.HELP_TEXT_DEVICE_CONCEPT) {
    root.HELP_TEXT_DEVICE_CONCEPT = parseMainHelpSection(json.HELP_TEXT_DEVICE_CONCEPT);
  }
  if (json.HELP_TEXT_TASKS_CONCEPT) {
    root.HELP_TEXT_TASKS_CONCEPT = parseMainHelpSection(json.HELP_TEXT_TASKS_CONCEPT);
  }
  if (json.HELP_TEXT_PRINT_CONCEPT) {
    root.HELP_TEXT_PRINT_CONCEPT = parseMainHelpSection(json.HELP_TEXT_PRINT_CONCEPT);
  }
  if (json.HELP_TEXT_USER_MANAGEMENT) {
    root.HELP_TEXT_USER_MANAGEMENT = parseMainHelpSection(json.HELP_TEXT_USER_MANAGEMENT);
  }
  if (json.HELP_TEXT_NETWORK_CONNECTION) {
    root.HELP_TEXT_NETWORK_CONNECTION = parseMainHelpSection(json.HELP_TEXT_NETWORK_CONNECTION);
  }
  if (json.HELP_TEXT_WEIGHING_FUNCTION) {
    root.HELP_TEXT_WEIGHING_FUNCTION = parseMainHelpSection(json.HELP_TEXT_WEIGHING_FUNCTION);
  }
  if (json.HELP_TEXT_TIMER_CNTRL_ACTION) {
    root.HELP_TEXT_TIMER_CNTRL_ACTION = parseMainHelpSection(json.HELP_TEXT_TIMER_CNTRL_ACTION);
  }
  if (json.HELP_TEXT_DEVICE_CLEANING) {
    root.HELP_TEXT_DEVICE_CLEANING = parseMainHelpSection(json.HELP_TEXT_DEVICE_CLEANING);
  }
  if (json.HELP_TEXT_DEVICE_MAINTENANCE) {
    root.HELP_TEXT_DEVICE_MAINTENANCE = parseMainHelpSection(json.HELP_TEXT_DEVICE_MAINTENANCE);
  }
  if (json.HELP_TEXT_JOB_MANAGEMENT) {
    root.HELP_TEXT_JOB_MANAGEMENT = parseMainHelpSection(json.HELP_TEXT_JOB_MANAGEMENT);
  }
  return root;
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
    }));
  }

  // content is an array of sections
  if (obj.content) {
    item.content = obj.content.map(parseHelpTextSection);
  }

  return item;
}

export function parseHelpTextSection(obj: any): HelpTextSection {
  if (obj.type === "TABLE") {
    return parseHelpTextTable(obj);
  }

  const sec = new HelpTextSection();
  sec.linkId = obj.linkId;
  sec.value = obj.value;
  sec.type = obj.type;
  sec.imageDescription = obj.imageDescription;
  sec.pdfWidth = obj.pdfWidth;
  sec.width = obj.width;

  if (((!sec.type) || (sec.type == "")) && (!sec.linkId || sec.linkId == "")) {
    console.error("JSON error. Section link ID is undefined or empty. Section value: ", sec.value);
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
  newTable.content = undefined;
  newTable.steps = undefined;
  newTable.subsections = undefined;

  return newTable;
}
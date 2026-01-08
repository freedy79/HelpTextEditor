import {
  HelpTextRoot,
  HelpTextSection,
  StructureIssue,
  isNonNestableType
} from './help-text-structure.model';

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

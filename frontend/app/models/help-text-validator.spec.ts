import { HelpContentType, HelpTextRoot, HelpTextSection, MainHelpSection } from './help-text-structure.model';
import { collectStructureIssues } from './help-text-validator';

describe('HelpTextValidator', () => {
  it('reports non-nestable sections with children', () => {
    const root = new HelpTextRoot();
    const mainSection = new MainHelpSection();
    const imageSection = new HelpTextSection();
    imageSection.type = HelpContentType.IMAGE;
    imageSection.id = 'IMAGE_1';
    imageSection.imageDescription = 'IMG_DESC';
    imageSection.content = [new HelpTextSection()];
    mainSection.content = [imageSection];
    root.setSection('HELP_TEXT_DEVICE_CONCEPT', mainSection);

    const issues = collectStructureIssues(root);

    expect(issues.length).toBe(1);
    expect(issues[0].sectionKey).toBe('IMG_DESC');
  });
});

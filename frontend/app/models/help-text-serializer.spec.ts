import { HelpContentType, HelpTextSection } from './help-text-structure.model';
import {
  parseHelpTextSection,
  serializeHelpTextSection
} from './help-text-serializer';

describe('HelpTextSerializer', () => {
  it('assigns id from value for text sections and preserves it in serialization', () => {
    const section = parseHelpTextSection({
      type: HelpContentType.INSTRUCTION,
      linkId: 'LINK_A',
      value: 'TEXT_KEY'
    });

    expect(section.id).toBe('TEXT_KEY');

    const serialized = serializeHelpTextSection(section as HelpTextSection);
    expect(serialized.id).toBe('TEXT_KEY');
    expect(serialized.value).toBe('TEXT_KEY');
    expect(serialized.type).toBe(HelpContentType.INSTRUCTION);
  });

  it('creates ids for valueless sections', () => {
    const section = parseHelpTextSection({
      type: HelpContentType.TABLE,
      header: [],
      rows: []
    });

    expect(section.id).toBeTruthy();

    const serialized = serializeHelpTextSection(section as HelpTextSection);
    expect(serialized.id).toBe(section.id);
    expect(serialized.type).toBe(HelpContentType.TABLE);
  });
});

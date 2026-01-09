import { HelpContentType, HelpTextSection, STANDALONE_SECTION_KEY } from './help-text-structure.model';
import {
  parseHelpTextRoot,
  parseHelpTextSection,
  serializeHelpTextRoot,
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

  it('parses standalone array roots into a synthetic main section', () => {
    const root = parseHelpTextRoot([
      {
        type: HelpContentType.INSTRUCTION,
        linkId: 'LINK_A',
        value: 'TEXT_KEY'
      }
    ]);

    const keys = root.getSectionKeys();
    expect(keys).toEqual([STANDALONE_SECTION_KEY]);
    expect(root.isStandalone()).toBe(true);
  });

  it('serializes standalone root content using the original format', () => {
    const root = parseHelpTextRoot({
      content: [
        {
          type: HelpContentType.INTRODUCTION,
          linkId: 'LINK_B',
          value: 'INTRO_KEY'
        }
      ]
    });

    const serialized = serializeHelpTextRoot(root) as { content: unknown[] };
    expect(Array.isArray(serialized.content)).toBe(true);
    expect(serialized.content[0]).toEqual(
      jasmine.objectContaining({
        type: HelpContentType.INTRODUCTION,
        value: 'INTRO_KEY'
      })
    );
  });
});

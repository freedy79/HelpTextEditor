import { Injectable } from '@angular/core';
import { HelpTocItem } from './help-toc.model';
import { HelpTextSection, MainHelpSection } from '../../models/help-text-structure.model';

@Injectable({ providedIn: 'root' })
export class HelpTocService {
  buildTocFromSection(section: MainHelpSection | null | undefined): HelpTocItem[] {
    const topSections: HelpTextSection[] = section?.content || [];

    return topSections
      .map((s) => this.mapSectionToTocItem(s, 1))
      .filter((x) => !!x) as HelpTocItem[];
  }

  private mapSectionToTocItem(section: HelpTextSection, level: number): HelpTocItem | null {
    if (!section) return null;

    const linkId = (section.linkId || '').trim();
    const key = (section.value || '').trim();

    const subs: HelpTextSection[] = section.subsections || [];
    const children = subs
      .map((x) => this.mapSectionToTocItem(x, level + 1))
      .filter((x) => !!x) as HelpTocItem[];

    // only include navigable nodes (need linkId + key),
    // but keep children in case parent is empty
    if (!linkId || !key) {
      return children.length ? { linkId: '', key: '', level, children } : null;
    }

    return { linkId, key, level, children };
  }
}

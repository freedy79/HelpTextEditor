import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { HelpTocItem } from './help-toc.model';

export type HelpTextsRoot = Record<string, any>;

@Injectable({ providedIn: 'root' })
export class HelpTocService {
  private cacheByUrl: Record<string, Observable<HelpTextsRoot>> = {};

  constructor(private http: HttpClient) {}

  loadStructure(url: string): Observable<HelpTextsRoot> {
    if (this.cacheByUrl[url]) return this.cacheByUrl[url];

    this.cacheByUrl[url] = this.http.get<HelpTextsRoot>(url).pipe(shareReplay(1));
    return this.cacheByUrl[url];
  }

  buildTocFromHelpKey(root: HelpTextsRoot, helpKey: string): HelpTocItem[] {
    const doc = root && root[helpKey];
    const topSections: any[] = (doc && doc.content) ? doc.content : [];

    return topSections
      .map((s) => this.mapSectionToTocItem(s, 1))
      .filter((x) => !!x) as HelpTocItem[];
  }

  private mapSectionToTocItem(section: any, level: number): HelpTocItem | null {
    if (!section) return null;

    const linkId = (section.linkId || '').trim();
    const key = (section.value || '').trim();

    const subs: any[] = section.subsections || [];
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

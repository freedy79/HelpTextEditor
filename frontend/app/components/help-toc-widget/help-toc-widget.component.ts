import {
  Component,
  Input,
  ChangeDetectionStrategy,
  OnDestroy,
  OnInit,
  HostListener
} from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { map, shareReplay, takeUntil } from 'rxjs/operators';
import { HelpTocService } from './help-toc.service';
import { HelpTocItem } from './help-toc.model';

type UserOverride = 'none' | 'expanded' | 'collapsed';

@Component({
  selector: 'app-help-toc-widget',
  templateUrl: './help-toc-widget.component.html',
  styleUrls: ['./help-toc-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpTocWidgetComponent implements OnInit, OnDestroy {
  /** e.g. "HELP_TEXT_DEVICE_CONCEPT" */
  @Input() helpKey!: string;

  /** e.g. "assets/helpTexts.json" */
  @Input() structureUrl = 'assets/helpTexts.json';

  /** Optional: custom translation function instead of template pipe */
  @Input() translateFn?: (key: string) => string;

  tocItems$!: Observable<HelpTocItem[]>;

  isCollapsed = false;
  private userOverride: UserOverride = 'none';

  activeLinkId: string | null = null;

  private readonly destroy$ = new Subject<void>();
  private intersectionObserver?: IntersectionObserver;

  // Behavior thresholds
  private readonly topExpandThresholdPx = 10;
  private readonly autoCollapseThresholdPx = 120;

  constructor(private tocService: HelpTocService) {}

  ngOnInit(): void {
    if (!this.helpKey) {
      // fail-safe: component is useless without helpKey
      this.tocItems$ = new Observable<HelpTocItem[]>((sub) => {
        sub.next([]);
        sub.complete();
      });
      return;
    }

    this.tocItems$ = this.tocService.loadStructure(this.structureUrl).pipe(
      map((root) => this.tocService.buildTocFromHelpKey(root, this.helpKey)),
      map((items) => this.normalize(items)),
      shareReplay(1)
    );

    this.tocItems$
      .pipe(takeUntil(this.destroy$))
      .subscribe((items) => this.setupIntersectionObserver(items));

    // Initial state
    this.applyScrollRules(window.scrollY || 0);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = undefined;
    }
  }

  toggleCollapsed(): void {
    this.isCollapsed = !this.isCollapsed;
    this.userOverride = this.isCollapsed ? 'collapsed' : 'expanded';
  }

  navigateTo(linkId: string): void {
    if (!linkId) return;

    const el = document.getElementById(linkId);
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  getLabel(key: string): string {
    return this.translateFn ? this.translateFn(key) : key;
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.applyScrollRules(window.scrollY || 0);
  }

  private applyScrollRules(scrollTop: number): void {
    // Always expand at top and reset manual override
    if (scrollTop <= this.topExpandThresholdPx) {
      this.isCollapsed = false;
      this.userOverride = 'none';
      return;
    }

    // Respect manual override
    if (this.userOverride === 'expanded') {
      this.isCollapsed = false;
      return;
    }
    if (this.userOverride === 'collapsed') {
      this.isCollapsed = true;
      return;
    }

    // Auto collapse when scrolling down
    this.isCollapsed = scrollTop >= this.autoCollapseThresholdPx;
  }

  private setupIntersectionObserver(items: HelpTocItem[]): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = undefined;
    }

    const flat = this.flatten(items)
      .map((x) => x.linkId)
      .filter((id) => !!id);

    if (!flat.length) return;

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          const id = (visible[0].target as HTMLElement).id;
          this.activeLinkId = id || null;
        }
      },
      {
        root: null,
        rootMargin: '0px 0px -70% 0px',
        threshold: [0, 0.1, 0.5, 1]
      }
    );

    for (const id of flat) {
      const el = document.getElementById(id);
      if (el) this.intersectionObserver.observe(el);
    }
  }

  private flatten(items: HelpTocItem[]): HelpTocItem[] {
    const out: HelpTocItem[] = [];

    const walk = (xs: HelpTocItem[]) => {
      for (const x of xs) {
        if (x.linkId && x.key) out.push(x);
        if (x.children && x.children.length) walk(x.children);
      }
    };

    walk(items);
    return out;
  }

  private normalize(items: HelpTocItem[]): HelpTocItem[] {
    const clean = (xs: HelpTocItem[]): HelpTocItem[] => {
      return xs
        .map((x) => ({
          ...x,
          children: x.children ? clean(x.children) : []
        }))
        .filter((x) => (x.linkId && x.key) || (x.children && x.children.length));
    };

    return clean(items);
  }
}

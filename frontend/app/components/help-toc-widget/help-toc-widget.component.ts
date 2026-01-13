import {
  Component,
  Input,
  ChangeDetectionStrategy,
  OnDestroy,
  OnInit,
  OnChanges
} from '@angular/core';
import { Observable, Subject, Subscription, fromEvent, of } from 'rxjs';
import { map, shareReplay, takeUntil } from 'rxjs/operators';
import { HelpTocService } from './help-toc.service';
import { HelpTocItem } from './help-toc.model';
import { MainHelpSection } from '../../models/help-text-structure.model';

type UserOverride = 'none' | 'expanded' | 'collapsed';

@Component({
  selector: 'app-help-toc-widget',
  templateUrl: './help-toc-widget.component.html',
  styleUrls: ['./help-toc-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpTocWidgetComponent implements OnInit, OnChanges, OnDestroy {
  /** Current selected help section structure. */
  @Input() section: MainHelpSection | null = null;

  /** Optional: custom translation function instead of template pipe */
  @Input() translateFn?: (key: string) => string;

  /** Optional: element to listen for scrolling (defaults to window). */
  @Input() scrollContainer?: HTMLElement | null;

  /** Optional: selector for scroll container if element reference isn't available. */
  @Input() scrollContainerSelector?: string;

  tocItems$!: Observable<HelpTocItem[]>;

  isCollapsed = false;
  private userOverride: UserOverride = 'none';

  activeLinkId: string | null = null;

  private activeScrollTarget: HTMLElement | Window = window;
  private readonly destroy$ = new Subject<void>();
  private intersectionObserver?: IntersectionObserver;
  private tocSubscription?: Subscription;
  private scrollSubscription?: Subscription;
  private latestItems: HelpTocItem[] = [];

  // Behavior thresholds
  private readonly topExpandThresholdPx = 10;
  private readonly autoCollapseThresholdPx = 120;

  constructor(private tocService: HelpTocService) {}

  ngOnInit(): void {
    this.buildToc();
    this.updateScrollTarget();
    // Initial state
    this.applyScrollRules(this.getScrollTop());
  }

  ngOnChanges(): void {
    this.buildToc();
    this.updateScrollTarget();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = undefined;
    }
    if (this.tocSubscription) {
      this.tocSubscription.unsubscribe();
      this.tocSubscription = undefined;
    }
    if (this.scrollSubscription) {
      this.scrollSubscription.unsubscribe();
      this.scrollSubscription = undefined;
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

  getLabel(key: string, translation?: string | null): string {
    const value = (translation ?? '').trim();
    return value ? value : key;
  }

  shouldShowKey(key: string, translation?: string | null): boolean {
    return this.getLabel(key, translation) !== key;
  }

  private updateScrollTarget(): void {
    const resolved = this.resolveScrollContainer();
    const nextTarget = resolved ?? window;
    const shouldRebind = this.activeScrollTarget !== nextTarget || !this.scrollSubscription;
    if (!shouldRebind) return;

    this.activeScrollTarget = nextTarget;

    if (this.scrollSubscription) {
      this.scrollSubscription.unsubscribe();
    }

    this.scrollSubscription = fromEvent(this.activeScrollTarget, 'scroll')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.applyScrollRules(this.getScrollTop()));

    if (this.latestItems.length) {
      this.setupIntersectionObserver(this.latestItems);
    }
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

  private getScrollTop(): number {
    if (this.activeScrollTarget === window) {
      return window.scrollY || 0;
    }

    return (this.activeScrollTarget as HTMLElement).scrollTop || 0;
  }

  private resolveScrollContainer(): HTMLElement | null {
    if (this.scrollContainer) return this.scrollContainer;
    if (this.scrollContainerSelector) {
      return document.querySelector(this.scrollContainerSelector);
    }
    return null;
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
        root: this.activeScrollTarget === window ? null : (this.activeScrollTarget as HTMLElement),
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

  private buildToc(): void {
    if (!this.section) {
      // fail-safe: component is useless without section
      this.tocItems$ = of([]);
      return;
    }

    this.tocItems$ = of(this.section).pipe(
      map((section) => this.tocService.buildTocFromSection(section)),
      map((items) => this.normalize(items)),
      shareReplay(1)
    );

    if (this.tocSubscription) {
      this.tocSubscription.unsubscribe();
    }

    this.tocSubscription = this.tocItems$
      .pipe(takeUntil(this.destroy$))
      .subscribe((items) => {
        this.latestItems = items;
        this.setupIntersectionObserver(items);
      });
  }
}

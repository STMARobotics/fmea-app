import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NavigationHistoryService {
  private readonly router = inject(Router);
  private readonly history: string[] = this.router.url && this.router.url !== '/'
    ? [this.router.url]
    : [];
  private pendingBackTarget: string | null = null;
  private pendingReplaceCurrent = false;

  constructor() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    ).subscribe(event => {
      const url = event.urlAfterRedirects;
      if (this.pendingReplaceCurrent) {
        this.pendingReplaceCurrent = false;
        this.pendingBackTarget = null;
        if (this.history.length > 0) {
          this.history[this.history.length - 1] = url;
        } else {
          this.history.push(url);
        }
        return;
      }

      if (this.pendingBackTarget === url) {
        this.history.pop();
        this.pendingBackTarget = null;
        return;
      }

      this.pendingBackTarget = null;
      if (this.history.at(-1) !== url) {
        this.history.push(url);
      }
    });
  }

  async navigateReplacingCurrent(url: string): Promise<boolean> {
    this.pendingReplaceCurrent = true;
    try {
      return await this.router.navigateByUrl(url, { replaceUrl: true });
    } finally {
      this.pendingReplaceCurrent = false;
    }
  }

  navigateBack(fallbackUrl: string): void {
    const previousUrl = this.history.at(-2);
    if (!previousUrl) {
      void this.router.navigateByUrl(fallbackUrl);
      return;
    }

    this.pendingBackTarget = previousUrl;
    void this.router.navigateByUrl(previousUrl).then(navigated => {
      if (!navigated) {
        this.pendingBackTarget = null;
      }
    });
  }
}

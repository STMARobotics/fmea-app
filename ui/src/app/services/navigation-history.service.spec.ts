import { NavigationEnd, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { NavigationHistoryService } from './navigation-history.service';

describe('NavigationHistoryService', () => {
  const routerEvents = new Subject<unknown>();
  const routerMock = {
    url: '/fmea',
    events: routerEvents,
    navigateByUrl: vi.fn(async (url: string) => {
      routerEvents.next(new NavigationEnd(1, url, url));
      return true;
    }),
  };

  beforeEach(() => {
    routerEvents.next(new NavigationEnd(0, '/fmea', '/fmea'));
    routerMock.navigateByUrl.mockClear();
    TestBed.configureTestingModule({
      providers: [
        NavigationHistoryService,
        { provide: Router, useValue: routerMock },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('replaces the current history entry so back navigation skips the replaced page', async () => {
    const navigationHistory = TestBed.inject(NavigationHistoryService);
    routerEvents.next(new NavigationEnd(1, '/fmea/new', '/fmea/new'));

    await navigationHistory.navigateReplacingCurrent('/fmea/entry-1');
    navigationHistory.navigateBack('/fmea');

    expect(routerMock.navigateByUrl).toHaveBeenNthCalledWith(1, '/fmea/entry-1', { replaceUrl: true });
    expect(routerMock.navigateByUrl).toHaveBeenNthCalledWith(2, '/fmea');
  });
});

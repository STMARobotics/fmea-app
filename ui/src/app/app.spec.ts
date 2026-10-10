import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { routes } from './app.routes';
import { BannerComponent } from './banner/banner.component';
import { FmeaSelectionService } from './services/fmea-selection.service';
import { FmeaService } from './services/fmea.service';
import { SeasonService } from './services/season.service';
import { TeamService } from './services/team.service';

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let selection: FmeaSelectionService;

  beforeEach(async () => {
    localStorage.removeItem('fmea.selectedTeamId');
    localStorage.removeItem('fmea.selectedSeasonId');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        { provide: FmeaService, useValue: { getFmeaEntriesForTeam: () => of([]), fmeaEntriesChanged$: of() } },
        { provide: SeasonService, useValue: { getAllSeasons: () => of([]) } },
        { provide: TeamService, useValue: { getAllTeams: () => of([]) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    selection = TestBed.inject(FmeaSelectionService);
  });

  it('redirects the root URL to the main FMEA page', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(router.url).toBe('/fmea');
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
    expect(compiled.querySelector('banner')).toBeTruthy();
    expect(compiled.querySelector('app-fmea-page')).toBeTruthy();
    expect(compiled.querySelector('app-fmea-page banner')).toBeNull();
    expect(compiled.querySelector('.fmea-grid')).toBeNull();
  });

  it('redirects unknown URLs to the main FMEA page', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/not-a-page');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.url).toBe('/fmea');
    expect(fixture.nativeElement.querySelector('app-fmea-page')).toBeTruthy();
  });

  it('opens the action items page with the shared team and season banner', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/action-items');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.url).toBe('/action-items');
    expect(fixture.nativeElement.querySelector('app-action-items-page')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-action-items-page .page-header')).toBeNull();
    expect(fixture.nativeElement.querySelector('banner')).toBeTruthy();
  });

  it('opens the FMEA information page', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/about-fmea');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.url).toBe('/about-fmea');
    expect(fixture.nativeElement.querySelector('app-fmea-info-page h1')?.textContent).toBe('What is FMEA?');
    expect(fixture.nativeElement.querySelector('app-fmea-info-page')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('banner')).toBeNull();
  });

  it('returns to the page that opened the FMEA information page using app navigation', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/fmea/new');
    await router.navigateByUrl('/about-fmea');
    fixture.detectChanges();
    await fixture.whenStable();

    const backButton = fixture.nativeElement.querySelector('.back-link') as HTMLButtonElement;
    backButton.click();
    await fixture.whenStable();

    expect(router.url).toBe('/fmea/new');
  });

  it('passes team and season changes into shared selection state', () => {
    const teamSpy = vi.spyOn(selection, 'selectTeam');
    const seasonSpy = vi.spyOn(selection, 'selectSeason');
    fixture.detectChanges();
    const banner = fixture.debugElement.query(By.directive(BannerComponent)).componentInstance as BannerComponent;

    banner.onTeamSelected('team-1');
    banner.onSeasonSelected('season-1');

    expect(teamSpy).toHaveBeenCalledWith('team-1');
    expect(seasonSpy).toHaveBeenCalledWith('season-1');
  });
});

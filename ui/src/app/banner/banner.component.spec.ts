import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSelectHarness } from '@angular/material/select/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { BannerComponent } from './banner.component';
import { SeasonService } from '../services/season.service';
import { TeamService } from '../services/team.service';
import { FmeaEntry, FmeaService } from '../services/fmea.service';

describe('BannerComponent', () => {
  let fixture: ComponentFixture<BannerComponent>;
  let component: BannerComponent;
  let getEntries: ReturnType<typeof vi.fn>;
  let fmeaEntriesChanged: Subject<void>;

  const entry: FmeaEntry = {
    id: 'entry-1',
    team: { id: 'ftc-team', program: 'ftc', teamNumber: 123, teamName: 'Robotics' },
    subsystem: { id: 'subsystem-1', name: 'Drive train' },
    failureMode: 'Motor failure',
    failureEffect: 'Robot cannot move',
    sev: 8,
    potentialCauses: 'Overheating',
    occ: 3,
    currentProcessControls: 'Thermal sensor',
    det: 2,
    lastUpdatedAt: new Date('2026-01-01'),
    actionItems: [],
  };

  const teams = [
    { id: 'ftc-team', num: 123, name: 'Robotics', program: 'ftc' as const },
    { id: 'frc-team', num: 456, name: 'Mechanics', program: 'frc' as const },
  ];
  const seasons = [
    { id: 'ftc-season', program: 'ftc' as const, name: 'Into the Deep' },
    { id: 'frc-season', program: 'frc' as const, name: 'Reefscape' },
  ];

  beforeEach(async () => {
    localStorage.removeItem('fmea.selectedTeamId');
    localStorage.removeItem('fmea.selectedSeasonId');
    getEntries = vi.fn(() => of([]));
    fmeaEntriesChanged = new Subject<void>();
    await TestBed.configureTestingModule({
      imports: [BannerComponent],
      providers: [
        provideRouter([]),
        { provide: TeamService, useValue: { getAllTeams: () => of(teams) } },
        { provide: SeasonService, useValue: { getAllSeasons: () => of(seasons) } },
        { provide: FmeaService, useValue: { getFmeaEntriesForTeam: getEntries, fmeaEntriesChanged$: fmeaEntriesChanged } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the team list and all seasons before a team is selected', async () => {
    await fixture.whenStable();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const [teamSelect] = await loader.getAllHarnesses(MatSelectHarness);
    await teamSelect.open();

    const teamOptions = await teamSelect.getOptions();
    expect(await Promise.all(teamOptions.map(option => option.getText()))).toEqual([
      'FTC 123 – Robotics',
      'FRC 456 – Mechanics',
    ]);
    expect(fixture.nativeElement.querySelectorAll('mat-form-field').length).toBe(1);

    const allSeasons = (await firstValueFrom(component.seasons$)).map(season => season.name);
    expect(allSeasons).toEqual(['Into the Deep', 'Reefscape']);
  });

  it('provides an accessible link to the FMEA information page', () => {
    const helpLink = fixture.nativeElement.querySelector('.help-link') as HTMLAnchorElement;
    expect(helpLink.getAttribute('href')).toBe('/about-fmea');
    expect(helpLink.getAttribute('aria-label')).toBe('Learn about FMEA');
    expect(helpLink.textContent.trim()).toBe('?');
  });

  it('provides banner navigation to the FMEA table and action items', () => {
    const pageLinks = fixture.nativeElement.querySelectorAll('.page-nav-link') as NodeListOf<HTMLAnchorElement>;

    expect(Array.from(pageLinks).map(link => [link.textContent?.trim(), link.getAttribute('href')]))
      .toEqual([
        ['FMEA table', '/fmea'],
        ['Action items', '/action-items'],
      ]);
  });

  it('filters seasons by team program and emits non-null selections', async () => {
    const teamChanges: string[] = [];
    const seasonChanges: string[] = [];
    component.teamChange.subscribe(value => teamChanges.push(value));
    component.seasonChange.subscribe(value => seasonChanges.push(value));

    component.onTeamSelected('ftc-team');
    component.onSeasonSelected('ftc-season');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('mat-form-field').length).toBe(2);
    expect(teamChanges).toEqual(['ftc-team']);
    expect(seasonChanges).toEqual(['ftc-season']);

    const loader = TestbedHarnessEnvironment.loader(fixture);
    const [, seasonSelect] = await loader.getAllHarnesses(MatSelectHarness);
    await seasonSelect.open();
    const options = await seasonSelect.getOptions();
    expect(await Promise.all(options.map(option => option.getText()))).toEqual(['Into the Deep']);
  });

  it('clears the season only when the team changes and handles null selections', () => {
    component.onTeamSelected('ftc-team');
    component.onSeasonSelected('ftc-season');
    component.onTeamSelected('ftc-team');
    expect(component.selectedSeasonId).toBe('ftc-season');

    component.onTeamSelected('frc-team');
    expect(component.selectedSeasonId).toBeNull();
    component.onTeamSelected(null);
    component.onSeasonSelected(null);

    expect(component.selectedTeamId).toBeNull();
    expect(component.selectedSeasonId).toBeNull();
  });

  it('does not request readiness for a new team with the previous team season', () => {
    component.onTeamSelected('ftc-team');
    component.onSeasonSelected('ftc-season');
    getEntries.mockClear();

    component.onTeamSelected('frc-team');

    expect(getEntries).not.toHaveBeenCalled();
  });

  it.each([
    { entries: [{ ...entry, sev: 10, occ: 10, det: 4 }], expected: 'Not event ready' },
    {
      entries: [
        { ...entry, id: 'moderate-1', sev: 101, occ: 1, det: 1 },
        { ...entry, id: 'low-1', sev: 100, occ: 1, det: 1 },
        { ...entry, id: 'low-2', sev: 100, occ: 1, det: 1 },
        { ...entry, id: 'low-3', sev: 100, occ: 1, det: 1 },
      ],
      expected: 'Not event ready',
    },
    {
      entries: [
        { ...entry, id: 'moderate-1', sev: 6, occ: 5, det: 4 },
        { ...entry, id: 'moderate-2', sev: 6, occ: 5, det: 4 },
        ...Array.from({ length: 18 }, (_, index) => ({
          ...entry,
          id: `low-${index}`,
          sev: 10,
          occ: 10,
          det: 1,
        })),
      ],
      expected: 'Event ready',
    },
    {
      entries: [
        ...Array.from({ length: 3 }, (_, index) => ({
          ...entry,
          id: `moderate-${index}`,
          sev: 6,
          occ: 5,
          det: 4,
        })),
        ...Array.from({ length: 17 }, (_, index) => ({
          ...entry,
          id: `low-${index}`,
          sev: 10,
          occ: 10,
          det: 1,
        })),
      ],
      expected: 'Not event ready',
    },
    { entries: [{ ...entry, sev: 10, occ: 10, det: 1 }], expected: 'da Vinci ready' },
  ])('shows "$expected" in the banner for the selected team and season', async ({ entries, expected }) => {
    getEntries.mockReturnValue(of(entries));
    component.onTeamSelected('ftc-team');
    component.onSeasonSelected('ftc-season');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getEntries).toHaveBeenCalledWith('ftc-team', 'ftc-season');
    expect(fixture.nativeElement.querySelector('.readiness-chip')?.textContent.trim()).toBe(expected);
  });

  it('shows Einstein ready for an FRC team at the highest readiness level', async () => {
    getEntries.mockReturnValue(of([{ ...entry, sev: 10, occ: 10, det: 1 }]));
    component.onTeamSelected('frc-team');
    component.onSeasonSelected('frc-season');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getEntries).toHaveBeenCalledWith('frc-team', 'frc-season');
    expect(fixture.nativeElement.querySelector('.readiness-chip')?.textContent.trim()).toBe('Einstein ready');
  });

  it('hides the readiness chip when the selected season has no FMEA entries', async () => {
    getEntries.mockReturnValue(of([]));
    component.onTeamSelected('ftc-team');
    component.onSeasonSelected('ftc-season');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.readiness-chip')).toBeNull();
  });

  it('shows an explicit unavailable status when readiness data fails to load', async () => {
    getEntries.mockReturnValue(throwError(() => new Error('network down')));
    component.onTeamSelected('ftc-team');
    component.onSeasonSelected('ftc-season');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.readiness-chip')?.textContent.trim()).toBe('Readiness unavailable');
  });

  it('reloads event readiness when an entry changes', async () => {
    getEntries
      .mockReturnValueOnce(of([entry]))
      .mockReturnValueOnce(of([{ ...entry, sev: 10, occ: 10, det: 4 }]));
    component.onTeamSelected('frc-team');
    component.onSeasonSelected('frc-season');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.readiness-chip')?.textContent.trim()).toBe('Einstein ready');

    fmeaEntriesChanged.next();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getEntries).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('.readiness-chip')?.textContent.trim()).toBe('Not event ready');
  });
});
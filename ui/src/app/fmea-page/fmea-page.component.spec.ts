import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { FmeaEntry, FmeaService } from '../services/fmea.service';
import { FmeaSelectionService } from '../services/fmea-selection.service';
import { SubsystemService } from '../services/subsystem.service';
import { FmeaPageComponent } from './fmea-page.component';

describe('FmeaPageComponent', () => {
  let fixture: ComponentFixture<FmeaPageComponent>;
  let selection: FmeaSelectionService;
  let getEntries: ReturnType<typeof vi.fn>;
  let getSubsystems: ReturnType<typeof vi.fn>;

  const entry: FmeaEntry = {
    id: 'entry-1',
    team: { id: 'team-1', program: 'frc', teamNumber: 123, teamName: 'Robotics' },
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

  beforeEach(async () => {
    getEntries = vi.fn(() => of([entry]));
    getSubsystems = vi.fn(() => of([
      { id: 'subsystem-1', teamId: 'team-1', seasonId: 'season-1', name: 'Drive train' },
      { id: 'subsystem-2', teamId: 'team-1', seasonId: 'season-1', name: 'Shooter' },
      { id: 'subsystem-3', teamId: 'team-1', seasonId: 'season-2', name: 'Other season subsystem' },
    ]));
    await TestBed.configureTestingModule({
      imports: [FmeaPageComponent],
      providers: [
        provideRouter([]),
        { provide: FmeaService, useValue: { getFmeaEntriesForTeam: getEntries } },
        { provide: SubsystemService, useValue: { getSubsystemsForTeam: getSubsystems } },
        FmeaSelectionService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FmeaPageComponent);
    selection = TestBed.inject(FmeaSelectionService);
    fixture.detectChanges();
  });

  it('renders no cards until a team and season are selected', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('fmea-entry-card').length).toBe(0);
    expect(fixture.nativeElement.querySelector('.create-entry-link')).toBeNull();
    expect(getEntries).not.toHaveBeenCalled();

    selection.selectTeam('team-1');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('fmea-entry-card').length).toBe(0);
    expect(fixture.nativeElement.querySelector('.controls-bar')).toBeNull();
    expect(fixture.nativeElement.querySelector('.create-entry-link')).toBeNull();
    expect(getEntries).not.toHaveBeenCalled();
    expect(getSubsystems).not.toHaveBeenCalled();
  });

  it('shows an empty-state message and hides filters when the selected season has no entries', async () => {
    getEntries.mockReturnValue(of([]));
    selection.selectTeam('team-1');
    selection.selectSeason('season-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.empty-state')?.textContent)
      .toContain('No FMEA entries have been added for this team and season yet.');
    expect(fixture.nativeElement.querySelector('.controls-bar')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.create-entry-link')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.filter-controls')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('fmea-entry-card').length).toBe(0);
  });

  it('loads and renders entries when both selections are available', async () => {
    selection.selectTeam('team-1');
    selection.selectSeason('season-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getEntries).toHaveBeenCalledWith('team-1', 'season-1');
    expect(getSubsystems).toHaveBeenCalledWith('team-1');
    expect(fixture.nativeElement.querySelector('fmea-entry-card h2')?.textContent).toContain('Motor failure');
    await expect(firstValueFrom(fixture.componentInstance.subsystemNames$))
      .resolves.toEqual(['Drive train', 'Shooter']);
    expect(fixture.nativeElement.querySelector('.controls-bar')).not.toBeNull();
  });

  it('keeps selected filters and sort in memory when the list component is recreated', () => {
    fixture.componentInstance.onActionItemFilterSelected('in_progress');
    fixture.componentInstance.onSubsystemSelected('Drive train');
    fixture.componentInstance.onSortSelected('last-updated-desc');

    fixture.destroy();
    fixture = TestBed.createComponent(FmeaPageComponent);

    expect(fixture.componentInstance.actionItemFilter).toBe('in_progress');
    expect(fixture.componentInstance.selectedSubsystem).toBe('Drive train');
    expect(fixture.componentInstance.selectedSort).toBe('last-updated-desc');
  });

  it('resets action-item and subsystem filters and sort from the reset button', async () => {
    selection.selectTeam('team-1');
    selection.selectSeason('season-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.onActionItemFilterSelected('in_progress');
    fixture.componentInstance.onSubsystemSelected('Drive train');
    fixture.componentInstance.onSortSelected('last-updated-desc');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const resetButton = fixture.nativeElement.querySelector('.reset-filters-button') as HTMLButtonElement;
    resetButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.actionItemFilter).toBe('all');
    expect(fixture.componentInstance.selectedSubsystem).toBe('');
    expect(fixture.componentInstance.selectedSort).toBe('rpn');
    expect(fixture.nativeElement.querySelectorAll('fmea-entry-card').length).toBe(1);
  });

  it('filters entries by subsystem and restores all entries when cleared', async () => {
    const secondEntry = {
      ...entry,
      id: 'entry-2',
      subsystem: { id: 'subsystem-2', name: 'Shooter' },
      failureMode: 'Wheel failure',
    };
    getEntries.mockReturnValue(of([entry, secondEntry]));
    getSubsystems.mockReturnValue(of([
      { id: 'subsystem-1', teamId: 'team-1', seasonId: 'season-1', name: 'Drive train' },
      { id: 'subsystem-2', teamId: 'team-1', seasonId: 'season-1', name: 'Shooter' },
      { id: 'subsystem-3', teamId: 'team-1', seasonId: 'season-2', name: 'Other season subsystem' },
    ]));

    selection.selectTeam('team-1');
    selection.selectSeason('season-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('fmea-entry-card').length).toBe(2);

    fixture.componentInstance.onSubsystemSelected('Drive train');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('fmea-entry-card').length).toBe(1);
    expect(fixture.nativeElement.querySelector('fmea-entry-card h2')?.textContent).toContain('Motor failure');

    fixture.componentInstance.onSubsystemSelected('');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('fmea-entry-card').length).toBe(2);
  });

  it('sorts by RPN descending by default and by subsystem with RPN descending as the sub-sort', async () => {
    const intakeEntry = {
      ...entry,
      id: 'entry-intake',
      subsystem: { id: 'subsystem-3', name: 'Intake' },
      failureMode: 'Intake failure',
      sev: 5,
      occ: 5,
      det: 5,
    };
    const lowerDriveEntry = {
      ...entry,
      id: 'entry-drive-lower',
      failureMode: 'Lower drive failure',
      sev: 2,
      occ: 2,
      det: 2,
    };
    getEntries.mockReturnValue(of([entry, intakeEntry, lowerDriveEntry]));

    selection.selectTeam('team-1');
    selection.selectSeason('season-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const getFailureModes = (): string[] => {
      const headings = fixture.nativeElement.querySelectorAll('fmea-entry-card h2') as NodeListOf<HTMLElement>;
      return Array.from(headings).map(heading => heading.textContent?.trim() ?? '');
    };

    expect(fixture.componentInstance.selectedSort).toBe('rpn');
    expect(getFailureModes()).toEqual(['Intake failure', 'Motor failure', 'Lower drive failure']);

    fixture.componentInstance.onSortSelected('subsystem');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getFailureModes()).toEqual(['Motor failure', 'Lower drive failure', 'Intake failure']);
  });

  it('sorts by last updated in ascending and descending order', async () => {
    const oldestEntry = {
      ...entry,
      id: 'entry-oldest',
      failureMode: 'Oldest failure',
      lastUpdatedAt: new Date('2025-12-01'),
    };
    const newestEntry = {
      ...entry,
      id: 'entry-newest',
      failureMode: 'Newest failure',
      lastUpdatedAt: new Date('2026-03-01'),
    };
    getEntries.mockReturnValue(of([newestEntry, entry, oldestEntry]));

    selection.selectTeam('team-1');
    selection.selectSeason('season-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const getFailureModes = (): string[] => {
      const headings = fixture.nativeElement.querySelectorAll('fmea-entry-card h2') as NodeListOf<HTMLElement>;
      return Array.from(headings).map(heading => heading.textContent?.trim() ?? '');
    };

    fixture.componentInstance.onSortSelected('last-updated-asc');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(getFailureModes()).toEqual(['Oldest failure', 'Motor failure', 'Newest failure']);

    fixture.componentInstance.onSortSelected('last-updated-desc');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(getFailureModes()).toEqual(['Newest failure', 'Motor failure', 'Oldest failure']);
  });

  it('filters moderate-critical entries without active actions and each action status independently of RPN', async () => {
    const createActionItem = (id: string, status: 'not_started' | 'in_progress' | 'assembly_note' | 'complete') => ({
      id,
      description: `Action ${id}`,
      status,
      fmeaEntryId: id,
      lastUpdatedAt: new Date('2026-01-01'),
    });
    const moderateWithoutAction = {
      ...entry,
      id: 'moderate-without-action',
      failureMode: 'Moderate without active action',
      sev: 6,
      occ: 5,
      det: 4,
      actionItems: [],
    };
    const criticalWithCompletedAction = {
      ...entry,
      id: 'critical-completed',
      failureMode: 'Critical with completed action',
      sev: 10,
      occ: 10,
      det: 4,
      actionItems: [createActionItem('critical-completed', 'complete')],
    };
    const criticalWithNotStartedAction = {
      ...entry,
      id: 'critical-not-started',
      failureMode: 'Critical not started',
      sev: 10,
      occ: 10,
      det: 4,
      actionItems: [createActionItem('critical-not-started', 'not_started')],
    };
    const moderateWithInProgressAction = {
      ...entry,
      id: 'moderate-in-progress',
      failureMode: 'Moderate in progress',
      sev: 6,
      occ: 5,
      det: 4,
      actionItems: [createActionItem('moderate-in-progress', 'in_progress')],
    };
    const criticalWithAssemblyNoteAction = {
      ...entry,
      id: 'critical-assembly-note',
      failureMode: 'Critical with assembly note',
      sev: 10,
      occ: 10,
      det: 4,
      actionItems: [createActionItem('critical-assembly-note', 'assembly_note')],
    };
    const lowWithNotStartedAction = {
      ...entry,
      id: 'low-not-started',
      failureMode: 'Low not started',
      sev: 10,
      occ: 10,
      det: 1,
      actionItems: [createActionItem('low-not-started', 'not_started')],
    };
    const lowWithInProgressAction = {
      ...entry,
      id: 'low-in-progress',
      failureMode: 'Low in progress',
      sev: 10,
      occ: 10,
      det: 1,
      actionItems: [createActionItem('low-in-progress', 'in_progress')],
    };
    getEntries.mockReturnValue(of([
      moderateWithoutAction,
      criticalWithCompletedAction,
      criticalWithNotStartedAction,
      moderateWithInProgressAction,
      criticalWithAssemblyNoteAction,
      lowWithNotStartedAction,
      lowWithInProgressAction,
    ]));

    selection.selectTeam('team-1');
    selection.selectSeason('season-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const getFailureModes = (): string[] => {
      const headings = fixture.nativeElement.querySelectorAll('fmea-entry-card h2') as NodeListOf<HTMLElement>;
      return Array.from(headings).map(heading => heading.textContent?.trim() ?? '');
    };

    expect(fixture.nativeElement.querySelectorAll('fmea-entry-card').length).toBe(7);

    fixture.componentInstance.onActionItemFilterSelected('moderate-critical-no-active');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(getFailureModes()).toEqual([
      'Critical with completed action',
      'Moderate without active action',
    ]);

    fixture.componentInstance.onActionItemFilterSelected('not_started');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(getFailureModes()).toEqual([
      'Critical not started',
      'Low not started',
    ]);

    fixture.componentInstance.onActionItemFilterSelected('in_progress');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(getFailureModes()).toEqual([
      'Moderate in progress',
      'Low in progress',
    ]);

    fixture.componentInstance.onActionItemFilterSelected('assembly_note');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(getFailureModes()).toEqual(['Critical with assembly note']);

    fixture.componentInstance.onActionItemFilterSelected('all');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('fmea-entry-card').length).toBe(7);
  });
});
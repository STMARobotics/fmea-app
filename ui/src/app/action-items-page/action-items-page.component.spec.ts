import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, tap, throwError } from 'rxjs';
import { ActionItemService } from '../services/action-item.service';
import { FmeaEntry, FmeaService } from '../services/fmea.service';
import { FmeaSelectionService } from '../services/fmea-selection.service';
import { ActionItemsPageComponent } from './action-items-page.component';

describe('ActionItemsPageComponent', () => {
  let fixture: ComponentFixture<ActionItemsPageComponent>;
  let selection: FmeaSelectionService;
  let getEntries: ReturnType<typeof vi.fn>;
  let updateActionItem: ReturnType<typeof vi.fn>;
  let fmeaEntriesChanged: Subject<void>;

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
    actionItems: [
      {
        id: 'action-1',
        description: 'Add temperature monitoring',
        status: 'in_progress',
        fmeaEntryId: 'entry-1',
        lastUpdatedAt: new Date('2026-02-01'),
      },
      {
        id: 'action-2',
        description: 'Document assembly inspection',
        status: 'complete',
        fmeaEntryId: 'entry-1',
        lastUpdatedAt: new Date('2026-02-02'),
      },
    ],
  };

  beforeEach(async () => {
    localStorage.removeItem('fmea.selectedTeamId');
    localStorage.removeItem('fmea.selectedSeasonId');
    getEntries = vi.fn(() => of([entry]));
    fmeaEntriesChanged = new Subject<void>();
    updateActionItem = vi.fn(() => of(entry.actionItems[0]).pipe(tap(() => fmeaEntriesChanged.next())));
    await TestBed.configureTestingModule({
      imports: [ActionItemsPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: FmeaService,
          useValue: { getFmeaEntriesForTeam: getEntries, fmeaEntriesChanged$: fmeaEntriesChanged.asObservable() },
        },
        {
          provide: ActionItemService,
          useValue: { updateActionItem },
        },
        FmeaSelectionService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ActionItemsPageComponent);
    selection = TestBed.inject(FmeaSelectionService);
    fixture.detectChanges();
  });

  it('asks for a team and season before loading action items', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent)
      .toContain('Select a team and season');
    expect(getEntries).not.toHaveBeenCalled();
  });

  it('groups action items into the requested board columns with links to their FMEA entries', async () => {
    selection.selectTeam('team-1');
    selection.selectSeason('season-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getEntries).toHaveBeenCalledWith('team-1', 'season-1');
    expect(fixture.nativeElement.querySelectorAll('.action-item')).toHaveLength(2);
    const columnHeadings = fixture.nativeElement.querySelectorAll('.column-header h2') as NodeListOf<HTMLHeadingElement>;
    expect(Array.from(columnHeadings).map(heading => heading.textContent?.trim()))
      .toEqual(['Assembly notes', 'Not started', 'In progress', 'Complete']);
    expect(fixture.nativeElement.querySelectorAll('.board-column')[0].querySelectorAll('.action-item'))
      .toHaveLength(0);
    expect(fixture.nativeElement.querySelectorAll('.board-column')[0].textContent)
      .toContain('No items');
    expect(fixture.nativeElement.querySelectorAll('.board-column')[2].querySelector('.description')?.textContent)
      .toContain('Add temperature monitoring');
    expect(fixture.nativeElement.querySelectorAll('.board-column')[3].querySelector('.description')?.textContent)
      .toContain('Document assembly inspection');
    expect(fixture.nativeElement.querySelector('.action-item .subsystem')?.textContent)
      .toContain('Drive train');
    expect(fixture.nativeElement.querySelector('.description')?.textContent)
      .toContain('Add temperature monitoring');
    expect(fixture.nativeElement.querySelector('.related-entry')?.textContent)
      .toContain('Motor failure');
    expect(fixture.nativeElement.querySelector('.related-entry a')?.getAttribute('href'))
      .toBe('/fmea/entry-1');
    expect(fixture.nativeElement.querySelectorAll('.status-control')).toHaveLength(0);
  });

  it('moves an action item when it is dropped into another status column', async () => {
    selection.selectTeam('team-1');
    selection.selectSeason('season-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    getEntries.mockReturnValueOnce(of([{
      ...entry,
      actionItems: entry.actionItems.map(item =>
        item.id === 'action-1' ? { ...item, status: 'complete' as const } : item,
      ),
    }]));
    const actionItem = fixture.nativeElement.querySelector('.action-item') as HTMLElement;
    const completeColumn = fixture.nativeElement.querySelectorAll('.board-column')[3] as HTMLElement;
    actionItem.dispatchEvent(new Event('dragstart', { bubbles: true }));
    completeColumn.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
    completeColumn.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(updateActionItem).toHaveBeenCalledWith('action-1', {
      description: 'Add temperature monitoring',
      status: 'complete',
      fmeaEntryId: 'entry-1',
    });
    expect(getEntries).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelectorAll('.board-column')[3].textContent)
      .toContain('Add temperature monitoring');
  });

  it('keeps the board visible while reloading after a status update', async () => {
    selection.selectTeam('team-1');
    selection.selectSeason('season-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const refreshedEntries = new Subject<FmeaEntry[]>();
    const updateResponse = new Subject<FmeaEntry['actionItems'][number]>();
    getEntries.mockReturnValueOnce(refreshedEntries);
    updateActionItem.mockReturnValue(updateResponse.pipe(tap(() => fmeaEntriesChanged.next())));
    const actionItem = fixture.nativeElement.querySelector('.action-item') as HTMLElement;
    const completeColumn = fixture.nativeElement.querySelectorAll('.board-column')[3] as HTMLElement;
    actionItem.dispatchEvent(new Event('dragstart', { bubbles: true }));
    completeColumn.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.board')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.action-item')).toHaveLength(2);
    expect(fixture.nativeElement.querySelectorAll('.board-column')[2].textContent)
      .not.toContain('Add temperature monitoring');
    expect(fixture.nativeElement.querySelectorAll('.board-column')[3].textContent)
      .toContain('Add temperature monitoring');
    expect(fixture.nativeElement.querySelector('.saving-label')).toBeNull();

    updateResponse.next(entry.actionItems[0]);
    updateResponse.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.board-column')[3].textContent)
      .toContain('Add temperature monitoring');
    refreshedEntries.next([{
      ...entry,
      actionItems: entry.actionItems.map(item =>
        item.id === 'action-1' ? { ...item, status: 'complete' as const } : item,
      ),
    }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.board-column')[2].textContent)
      .not.toContain('Add temperature monitoring');
    expect(fixture.nativeElement.querySelectorAll('.board-column')[3].textContent)
      .toContain('Add temperature monitoring');
  });

  it('shows an error when an action item status update fails', async () => {
    updateActionItem.mockReturnValue(throwError(() => new Error('Unable to update action item (503).')));
    selection.selectTeam('team-1');
    selection.selectSeason('season-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const actionItem = fixture.nativeElement.querySelector('.action-item') as HTMLElement;
    const completeColumn = fixture.nativeElement.querySelectorAll('.board-column')[3] as HTMLElement;
    actionItem.dispatchEvent(new Event('dragstart', { bubbles: true }));
    completeColumn.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
      .toContain('Unable to update action item (503).');
    expect(fixture.nativeElement.querySelectorAll('.board-column')[2].textContent)
      .toContain('Add temperature monitoring');
    expect(fixture.nativeElement.querySelector('.saving-label')).toBeNull();
  });

  it('shows the empty state when the selected season has no action items', async () => {
    getEntries.mockReturnValue(of([{ ...entry, actionItems: [] }]));
    selection.selectTeam('team-1');
    selection.selectSeason('season-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent)
      .toContain('No action items have been added');
  });

  it('filters action items in every column by subsystem without reloading entries', async () => {
    const otherSubsystemEntry: FmeaEntry = {
      ...entry,
      id: 'entry-2',
      subsystem: { id: 'subsystem-2', name: 'Shooter' },
      actionItems: [
        {
          id: 'action-3',
          description: 'Add assembly checklist',
          status: 'assembly_note',
          fmeaEntryId: 'entry-2',
          lastUpdatedAt: new Date('2026-02-03'),
        },
        {
          id: 'action-4',
          description: 'Test shooter motor',
          status: 'not_started',
          fmeaEntryId: 'entry-2',
          lastUpdatedAt: new Date('2026-02-04'),
        },
      ],
    };
    getEntries.mockReturnValue(of([entry, otherSubsystemEntry]));
    selection.selectTeam('team-1');
    selection.selectSeason('season-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.result-count')).toBeNull();
    expect(fixture.nativeElement.querySelector('mat-select')).not.toBeNull();
    fixture.componentInstance.onSubsystemSelected('Drive train');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.action-item')).toHaveLength(2);
    expect(fixture.nativeElement.querySelectorAll('.board-column')[0].textContent)
      .toContain('No items match this subsystem');
    expect(fixture.nativeElement.querySelectorAll('.board-column')[1].textContent)
      .toContain('No items match this subsystem');
    expect(getEntries).toHaveBeenCalledTimes(1);

    fixture.componentInstance.onSubsystemSelected('Shooter');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.action-item')).toHaveLength(2);
    expect(fixture.nativeElement.querySelectorAll('.board-column')[0].querySelector('.description')?.textContent)
      .toContain('Add assembly checklist');
    expect(fixture.nativeElement.querySelectorAll('.board-column')[1].querySelector('.description')?.textContent)
      .toContain('Test shooter motor');
    expect(getEntries).toHaveBeenCalledTimes(1);
  });

  it('retains the selected subsystem when the page is recreated', async () => {
    const otherSubsystemEntry: FmeaEntry = {
      ...entry,
      id: 'entry-2',
      subsystem: { id: 'subsystem-2', name: 'Shooter' },
      actionItems: [{
        id: 'action-3',
        description: 'Test shooter motor',
        status: 'not_started',
        fmeaEntryId: 'entry-2',
        lastUpdatedAt: new Date('2026-02-03'),
      }],
    };
    getEntries.mockReturnValue(of([entry, otherSubsystemEntry]));
    selection.selectTeam('team-1');
    selection.selectSeason('season-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.onSubsystemSelected('Shooter');
    fixture.detectChanges();
    fixture.destroy();

    fixture = TestBed.createComponent(ActionItemsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedSubsystem()).toBe('Shooter');
    expect(fixture.nativeElement.querySelectorAll('.action-item')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.description')?.textContent).toContain('Test shooter motor');
  });

  it('shows an error state when the FMEA request fails', async () => {
    getEntries.mockReturnValue(throwError(() => new Error('Unable to load FMEA items (503).')));
    selection.selectTeam('team-1');
    selection.selectSeason('season-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
      .toContain('Unable to load FMEA items (503).');
  });
});

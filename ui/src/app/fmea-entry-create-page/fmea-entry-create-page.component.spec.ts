import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { FmeaEntry, FmeaService } from '../services/fmea.service';
import { FmeaSelectionService } from '../services/fmea-selection.service';
import { NavigationHistoryService } from '../services/navigation-history.service';
import { SubsystemService } from '../services/subsystem.service';
import { FmeaEntryCreatePageComponent } from './fmea-entry-create-page.component';

describe('FmeaEntryCreatePageComponent', () => {
  let fixture: ComponentFixture<FmeaEntryCreatePageComponent>;
  let component: FmeaEntryCreatePageComponent;
  const createdEntry: FmeaEntry = {
    id: 'entry-1',
    team: { id: 'team-1', program: 'ftc', teamNumber: 123, teamName: 'Robotics' },
    subsystem: { id: 'subsystem-1', name: 'Drivetrain' },
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
  const createFmeaEntry = vi.fn((_request: unknown, _submissionId: string) => of(createdEntry));
  const navigateReplacingCurrent = vi.fn(() => Promise.resolve(true));

  beforeEach(async () => {
    createFmeaEntry.mockClear();
    navigateReplacingCurrent.mockClear();
    await TestBed.configureTestingModule({
      imports: [FmeaEntryCreatePageComponent],
      providers: [
        provideRouter([]),
        {
          provide: FmeaSelectionService,
          useValue: { selectedTeamId$: of('team-1'), selectedSeasonId$: of('season-1') },
        },
        { provide: FmeaService, useValue: { createFmeaEntry } },
        { provide: NavigationHistoryService, useValue: { navigateReplacingCurrent } },
        {
          provide: SubsystemService,
          useValue: { getSubsystemsForTeam: () => of([{ id: 'subsystem-1', teamId: 'team-1', seasonId: 'season-1', name: 'Drivetrain' }]) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FmeaEntryCreatePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('starts with empty required ratings', () => {
    expect(component.form.controls.sev.value).toBeNull();
    expect(component.form.controls.occ.value).toBeNull();
    expect(component.form.controls.det.value).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('app-rating-cheat-sheet')).toHaveLength(3);
    expect(component.form.controls.sev.hasError('required')).toBe(true);
    expect(component.form.controls.occ.hasError('required')).toBe(true);
    expect(component.form.controls.det.hasError('required')).toBe(true);
  });

  it('submits occurrence and detection from their own controls', async () => {
    component.form.setValue({
      subsystemId: 'subsystem-1',
      failureMode: 'Motor failure',
      failureEffect: 'Robot cannot move',
      sev: 8,
      potentialCauses: 'Overheating',
      occ: 3,
      currentProcessControls: 'Thermal sensor',
      det: 2,
    });

    await component.onSubmit();

    expect(createFmeaEntry).toHaveBeenCalledWith({
      teamId: 'team-1',
      seasonId: 'season-1',
      subsystemId: 'subsystem-1',
      failureMode: 'Motor failure',
      failureEffect: 'Robot cannot move',
      sev: 8,
      potentialCauses: 'Overheating',
      occ: 3,
      currentProcessControls: 'Thermal sensor',
      det: 2,
    }, expect.any(String));
    expect(navigateReplacingCurrent).toHaveBeenCalledWith('/fmea/entry-1');
  });

  it('reuses the same submission key after an ambiguous failure and changes it for changed content', async () => {
    component.form.setValue({subsystemId:'subsystem-1',failureMode:'Motor failure',failureEffect:'Robot cannot move',sev:8,potentialCauses:'Overheating',occ:3,currentProcessControls:'Thermal sensor',det:2});
    createFmeaEntry.mockImplementationOnce(() => throwError(() => new Error('Connection lost')));
    await component.onSubmit();
    const firstKey = createFmeaEntry.mock.calls[0][1];
    await component.onSubmit();
    expect(createFmeaEntry.mock.calls[1][1]).toBe(firstKey);
    component.form.controls.failureMode.setValue('A different failure');
    await component.onSubmit();
    expect(createFmeaEntry.mock.calls[2][1]).not.toBe(firstKey);
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { FmeaSelectionService } from '../services/fmea-selection.service';
import { SubsystemService } from '../services/subsystem.service';
import { DeleteSubsystemDialogComponent } from './delete-subsystem-dialog.component';
import { SubsystemsPageComponent } from './subsystems-page.component';

describe('SubsystemsPageComponent', () => {
  let fixture: ComponentFixture<SubsystemsPageComponent>;
  let component: SubsystemsPageComponent;
  let createSubsystem: ReturnType<typeof vi.fn>;
  let updateSubsystem: ReturnType<typeof vi.fn>;
  let deleteSubsystem: ReturnType<typeof vi.fn>;
  let dialogOpen: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    createSubsystem = vi.fn(() => of({
      id: 'subsystem-3',
      teamId: 'team-1',
      seasonId: 'season-1',
      name: 'Arm',
    }));
    updateSubsystem = vi.fn(() => of({
      id: 'subsystem-1',
      teamId: 'team-1',
      seasonId: 'season-1',
      name: 'Drivetrain',
    }));
    deleteSubsystem = vi.fn(() => of(undefined));
    dialogOpen = vi.fn(() => ({ afterClosed: () => of(true) }));
    await TestBed.configureTestingModule({
      imports: [SubsystemsPageComponent],
      providers: [
        {
          provide: FmeaSelectionService,
          useValue: {
            selectedTeamId: 'team-1',
            selectedSeasonId: 'season-1',
            selectedTeamId$: of('team-1'),
            selectedSeasonId$: of('season-1'),
          },
        },
        {
          provide: SubsystemService,
          useValue: {
            getSubsystemsForTeam: () => of([
              { id: 'subsystem-1', teamId: 'team-1', seasonId: 'season-1', name: 'Drive train' },
              { id: 'subsystem-2', teamId: 'team-1', seasonId: 'season-2', name: 'Old season only' },
            ]),
            createSubsystem,
            updateSubsystem,
            deleteSubsystem,
          },
        },
        {
          provide: MatDialog,
          useValue: { open: dialogOpen },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubsystemsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('adds a subsystem for the selected team and season', async () => {
    component.createForm.setValue({ name: 'Arm' });
    await component.addSubsystem();

    expect(createSubsystem).toHaveBeenCalledWith('team-1', {
      seasonId: 'season-1',
      name: 'Arm',
    });
    expect(component.successMessage()).toBe('Subsystem added.');
  });

  it('renames a subsystem without showing other seasons in the list', async () => {
    component.editSubsystem({
      id: 'subsystem-1',
      teamId: 'team-1',
      seasonId: 'season-1',
      name: 'Drive train',
    });
    component.editForm.setValue({ name: 'Drivetrain' });
    await component.saveSubsystem('subsystem-1');

    expect(updateSubsystem).toHaveBeenCalledWith('team-1', 'subsystem-1', 'Drivetrain');
    expect(component.successMessage()).toBe('Subsystem updated.');
    const renderedText = fixture.nativeElement.textContent as string;
    expect(renderedText).not.toContain('Old season only');
  });

  it('asks for confirmation before deleting a subsystem', async () => {
    const subsystem = {
      id: 'subsystem-1',
      teamId: 'team-1',
      seasonId: 'season-1',
      name: 'Drive train',
    };
    await component.deleteSubsystem(subsystem);

    expect(dialogOpen).toHaveBeenCalledWith(
      DeleteSubsystemDialogComponent,
      expect.objectContaining({ data: { subsystemName: 'Drive train' } }),
    );
    expect(deleteSubsystem).toHaveBeenCalledWith('team-1', 'subsystem-1');
    expect(component.successMessage()).toBe('Subsystem deleted.');
  });

  it('does not delete a subsystem when confirmation is cancelled', async () => {
    dialogOpen.mockImplementation(() => ({ afterClosed: () => of(false) }));
    await component.deleteSubsystem({
      id: 'subsystem-1',
      teamId: 'team-1',
      seasonId: 'season-1',
      name: 'Drive train',
    });

    expect(deleteSubsystem).not.toHaveBeenCalled();
  });
});

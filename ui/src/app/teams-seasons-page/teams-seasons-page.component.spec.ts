import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SeasonService } from '../services/season.service';
import { TeamService } from '../services/team.service';
import { TeamsSeasonsPageComponent } from './teams-seasons-page.component';

describe('TeamsSeasonsPageComponent', () => {
  let fixture: ComponentFixture<TeamsSeasonsPageComponent>;
  let component: TeamsSeasonsPageComponent;
  let createTeam: ReturnType<typeof vi.fn>;
  let updateSeason: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    createTeam = vi.fn(() => of({
      id: 'team-1',
      num: 7028,
      name: 'Robotics',
      program: 'frc' as const,
    }));
    updateSeason = vi.fn(() => of({
      id: 'season-1',
      program: 'frc' as const,
      name: 'New season name',
    }));
    await TestBed.configureTestingModule({
      imports: [TeamsSeasonsPageComponent],
      providers: [
        {
          provide: TeamService,
          useValue: { getAllTeams: () => of([]), createTeam, updateTeam: vi.fn() },
        },
        {
          provide: SeasonService,
          useValue: { getAllSeasons: () => of([]), createSeason: vi.fn(), updateSeason },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TeamsSeasonsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('creates a team with the configured program, number, and name', async () => {
    component.teamForm.setValue({ program: 'ftc', teamNumber: 123, name: 'Robotics' });
    await component.saveTeam();

    expect(createTeam).toHaveBeenCalledWith({
      program: 'ftc',
      teamNumber: 123,
      name: 'Robotics',
    });
    expect(component.teams()).toEqual([{
      id: 'team-1',
      num: 7028,
      name: 'Robotics',
      program: 'frc',
    }]);
    expect(component.successMessage()).toBe('Team created.');
  });

  it('updates a selected season and replaces its displayed record', async () => {
    component.editSeason({ id: 'season-1', program: 'ftc', name: 'Old season name' });
    component.seasonForm.setValue({ program: 'frc', name: 'New season name' });
    await component.saveSeason();

    expect(updateSeason).toHaveBeenCalledWith('season-1', {
      program: 'frc',
      name: 'New season name',
    });
    expect(component.seasons()).toEqual([{
      id: 'season-1',
      program: 'frc',
      name: 'New season name',
    }]);
  });
});

import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { TeamService } from './team.service';

describe('TeamService', () => {
  let service: TeamService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TeamService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps API team fields into the app team model', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve([
        { id: 'team-1', teamNumber: 123, teamName: 'Robotics', program: 'ftc' },
      ]),
    }));

    await expect(firstValueFrom(service.getAllTeams())).resolves.toEqual([
      { id: 'team-1', num: 123, name: 'Robotics', program: 'ftc' },
    ]);
  });
});

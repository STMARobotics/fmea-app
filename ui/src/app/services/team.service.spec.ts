import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { TeamService } from './team.service';

describe('TeamService', () => {
  let service: TeamService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TeamService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('maps API team fields into the app team model', async () => {
    const result = firstValueFrom(service.getAllTeams());
    http.expectOne('/api/teams').flush([
      { id: 'team-1', teamNumber: 123, name: 'Robotics', program: 'ftc' },
    ]);
    await expect(result).resolves.toEqual([
      { id: 'team-1', num: 123, name: 'Robotics', program: 'ftc' },
    ]);
  });

  it('creates a team and signals team-list refresh', async () => {
    const changed = vi.fn();
    service.teamsChanged$.subscribe(changed);
    const result = firstValueFrom(service.createTeam({
      program: 'ftc',
      teamNumber: 123,
      name: 'Robotics',
    }));
    const request = http.expectOne('/api/teams');
    expect(request.request.method).toBe('POST');
    request.flush({ id: 'team-1', teamNumber: 123, name: 'Robotics', program: 'ftc' });

    await expect(result).resolves.toEqual({
      id: 'team-1',
      num: 123,
      name: 'Robotics',
      program: 'ftc',
    });
    expect(changed).toHaveBeenCalledOnce();
  });

  it('updates a team through its encoded API URL', async () => {
    const result = firstValueFrom(service.updateTeam('team/id', { name: 'New name' }));
    const request = http.expectOne('/api/teams/team%2Fid');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ name: 'New name' });
    request.flush({ id: 'team/id', teamNumber: 123, name: 'New name', program: 'ftc' });
    await expect(result).resolves.toMatchObject({ id: 'team/id', name: 'New name' });
  });
});

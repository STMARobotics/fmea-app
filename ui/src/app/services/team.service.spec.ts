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
});

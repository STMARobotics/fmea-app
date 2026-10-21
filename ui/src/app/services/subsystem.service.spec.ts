import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { SubsystemService } from './subsystem.service';

describe('SubsystemService', () => {
  let service: SubsystemService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SubsystemService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('requests subsystems for the given team', async () => {
    const subsystems = [{
      id: 'subsystem-1',
      teamId: 'team-1',
      seasonId: 'season-1',
      name: 'Drive train',
    }];
    const result = firstValueFrom(service.getSubsystemsForTeam('team-1'));
    http.expectOne('/api/subsystems/team-1').flush(subsystems);
    await expect(result).resolves.toEqual(subsystems);
  });

  it('reports an HTTP error when subsystems cannot be loaded', async () => {
    const result = firstValueFrom(service.getSubsystemsForTeam('team-1'));
    http.expectOne('/api/subsystems/team-1').flush({}, { status: 503, statusText: 'Unavailable' });
    await expect(result)
      .rejects.toThrow('Unable to load subsystems (503).');
  });

  it('creates a subsystem for the given team', async () => {
    const request = { seasonId: 'season-1', name: 'Arm' };
    const subsystem = {
      id: 'subsystem-2',
      teamId: 'team-1',
      ...request,
    };
    const result = firstValueFrom(service.createSubsystem('team-1', request));
    const apiRequest = http.expectOne('/api/subsystems/team-1');
    expect(apiRequest.request.method).toBe('POST');
    expect(apiRequest.request.body).toEqual(request);
    apiRequest.flush(subsystem);
    await expect(result).resolves.toEqual(subsystem);
  });

  it('reports an HTTP error when a subsystem cannot be created', async () => {
    const result = firstValueFrom(service.createSubsystem('team-1', {
      seasonId: 'season-1',
      name: 'Arm',
    }));
    http.expectOne('/api/subsystems/team-1').flush({}, { status: 400, statusText: 'Bad Request' });
    await expect(result).rejects.toThrow('Unable to create subsystem (400).');
  });

  it('updates a subsystem name through the API', async () => {
    const result = firstValueFrom(service.updateSubsystem('team-1', 'subsystem-1', 'Drivetrain'));
    const request = http.expectOne('/api/subsystems/team-1/subsystem-1');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ name: 'Drivetrain' });
    request.flush({
      id: 'subsystem-1',
      teamId: 'team-1',
      seasonId: 'season-1',
      name: 'Drivetrain',
    });
    await expect(result).resolves.toMatchObject({ name: 'Drivetrain' });
  });
});

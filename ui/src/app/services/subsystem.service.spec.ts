import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SubsystemService } from './subsystem.service';

describe('SubsystemService', () => {
  let service: SubsystemService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SubsystemService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests subsystems for the given team', async () => {
    const subsystems = [{
      id: 'subsystem-1',
      teamId: 'team-1',
      seasonId: 'season-1',
      name: 'Drive train',
    }];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(subsystems) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(firstValueFrom(service.getSubsystemsForTeam('team-1'))).resolves.toEqual(subsystems);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/subsystems/team-1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('reports an HTTP error when subsystems cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    await expect(firstValueFrom(service.getSubsystemsForTeam('team-1')))
      .rejects.toThrow('Unable to load subsystems (503).');
  });

  it('creates a subsystem for the given team', async () => {
    const request = { seasonId: 'season-1', name: 'Arm' };
    const subsystem = {
      id: 'subsystem-2',
      teamId: 'team-1',
      ...request,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(subsystem),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(firstValueFrom(service.createSubsystem('team-1', request)))
      .resolves.toEqual(subsystem);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/subsystems/team-1',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('reports an HTTP error when a subsystem cannot be created', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }));

    await expect(firstValueFrom(service.createSubsystem('team-1', {
      seasonId: 'season-1',
      name: 'Arm',
    }))).rejects.toThrow('Unable to create subsystem (400).');
  });
});

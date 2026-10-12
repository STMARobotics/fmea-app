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
});

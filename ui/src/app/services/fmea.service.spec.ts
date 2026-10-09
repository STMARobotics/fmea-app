import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { FmeaEntry, FmeaService, PartialFmeaEntry } from './fmea.service';

describe('FmeaService', () => {
  let service: FmeaService;
  const entries: FmeaEntry[] = [{
    id: 'entry-1',
    team: { id: 'team-1', program: 'ftc', teamNumber: 123, teamName: 'Robotics' },
    subsystem: { id: 'subsystem-1', name: 'Drive train' },
    failureMode: 'Motor failure',
    failureEffect: 'Robot cannot move',
    sev: 8,
    potentialCauses: 'Overheating',
    occ: 3,
    currentProcessControls: 'Thermal sensor',
    det: 2,
    lastUpdatedAt: new Date('2026-01-01'),
    actionItems: [],
  }];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FmeaService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests and returns entries for the given team and season', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(entries) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(firstValueFrom(service.getFmeaEntriesForTeam('team-1', 'season-1'))).resolves.toEqual(entries);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/fmea/team-1/season-1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('reports an HTTP error when FMEA items cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    await expect(firstValueFrom(service.getFmeaEntriesForTeam('team-1', 'season-1')))
      .rejects.toThrow('Unable to load FMEA items (503).');
  });

  it('requests a single FMEA entry by id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(entries[0]),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(firstValueFrom(service.getFmeaEntry('entry-1'))).resolves.toEqual(entries[0]);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/fmea/entry-1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('reports an HTTP error when a single FMEA entry cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(firstValueFrom(service.getFmeaEntry('missing')))
      .rejects.toThrow('Unable to load FMEA item (404).');
  });

  it('posts a partial FMEA entry and returns the created entry', async () => {
    const partialEntry: PartialFmeaEntry = {
      subsystemId: 'subsystem-1',
      failureMode: 'TEST entry: motor failure',
      failureEffect: 'Test-only failure effect',
      sev: 4,
      potentialCauses: 'Test-only potential cause',
      occ: 3,
      currentProcessControls: 'Test-only process control',
      det: 2,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(entries[0]),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(firstValueFrom(service.createFmeaEntry(partialEntry))).resolves.toEqual(entries[0]);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/fmea/new',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partialEntry),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('reports an HTTP error when an FMEA entry cannot be created', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }));

    await expect(firstValueFrom(service.createFmeaEntry({
      subsystemId: 'subsystem-1',
      failureMode: 'TEST entry',
      failureEffect: 'Test-only effect',
      sev: 1,
      potentialCauses: 'Test-only cause',
      occ: 1,
      currentProcessControls: 'Test-only control',
      det: 1,
    }))).rejects.toThrow('Unable to create FMEA item (400).');
  });

  it('deletes an FMEA entry by id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('') });
    vi.stubGlobal('fetch', fetchMock);

    await expect(firstValueFrom(service.deleteFmeaEntry('entry-1'))).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/fmea/entry-1',
      expect.objectContaining({
        method: 'DELETE',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('reports an HTTP error when an FMEA entry cannot be deleted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(firstValueFrom(service.deleteFmeaEntry('entry-1')))
      .rejects.toThrow('Unable to delete FMEA item (500).');
  });

  it('notifies readiness subscribers after successful creates, updates, and deletes', async () => {
    const changes: void[] = [];
    const subscription = service.fmeaEntriesChanged$.subscribe(() => changes.push(undefined));
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(entries[0]) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(entries[0]) })
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('') }));
    const partialEntry: PartialFmeaEntry = {
      subsystemId: 'subsystem-1',
      failureMode: 'Motor failure',
      failureEffect: 'Robot cannot move',
      sev: 8,
      potentialCauses: 'Overheating',
      occ: 3,
      currentProcessControls: 'Thermal sensor',
      det: 2,
    };

    await firstValueFrom(service.createFmeaEntry(partialEntry));
    await firstValueFrom(service.updateFmeaEntry('entry-1', partialEntry));
    await firstValueFrom(service.deleteFmeaEntry('entry-1'));
    subscription.unsubscribe();

    expect(changes).toHaveLength(3);
  });
});

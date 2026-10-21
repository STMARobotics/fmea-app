import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { CreateFmeaEntryRequest, FmeaEntry, FmeaService, PartialFmeaEntry } from './fmea.service';

describe('FmeaService', () => {
  let service: FmeaService;
  let http: HttpTestingController;
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
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(FmeaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('requests and returns entries for the given team and season', async () => {
    const result = firstValueFrom(service.getFmeaEntriesForTeam('team-1', 'season-1'));
    http.expectOne('/api/fmea/team-1/season-1').flush(entries);
    await expect(result).resolves.toEqual(entries);
  });

  it('shares an in-flight request for the same team and season', async () => {
    const firstResult = firstValueFrom(service.getFmeaEntriesForTeam('team-1', 'season-1'));
    const secondResult = firstValueFrom(service.getFmeaEntriesForTeam('team-1', 'season-1'));

    http.expectOne('/api/fmea/team-1/season-1').flush(entries);

    await expect(Promise.all([firstResult, secondResult])).resolves.toEqual([entries, entries]);
  });

  it('fetches fresh entries after the previous request completes', async () => {
    const firstResult = firstValueFrom(service.getFmeaEntriesForTeam('team-1', 'season-1'));
    http.expectOne('/api/fmea/team-1/season-1').flush(entries);
    await firstResult;

    const secondResult = firstValueFrom(service.getFmeaEntriesForTeam('team-1', 'season-1'));
    http.expectOne('/api/fmea/team-1/season-1').flush(entries);
    await expect(secondResult).resolves.toEqual(entries);
  });

  it('reports an HTTP error when FMEA items cannot be loaded', async () => {
    const result = firstValueFrom(service.getFmeaEntriesForTeam('team-1', 'season-1'));
    http.expectOne('/api/fmea/team-1/season-1').flush({}, { status: 503, statusText: 'Unavailable' });
    await expect(result)
      .rejects.toThrow('Unable to load FMEA items (503).');
  });

  it('requests a single FMEA entry by id', async () => {
    const result = firstValueFrom(service.getFmeaEntry('entry-1'));
    http.expectOne('/api/fmea/entry-1').flush(entries[0]);
    await expect(result).resolves.toEqual(entries[0]);
  });

  it('reports an HTTP error when a single FMEA entry cannot be loaded', async () => {
    const result = firstValueFrom(service.getFmeaEntry('missing'));
    http.expectOne('/api/fmea/missing').flush({}, { status: 404, statusText: 'Not Found' });
    await expect(result)
      .rejects.toThrow('Unable to load FMEA item (404).');
  });

  it('posts a FMEA entry and returns the created entry', async () => {
    const partialEntry: CreateFmeaEntryRequest = {
      teamId: 'team-1',
      seasonId: 'season-1',
      subsystemId: 'subsystem-1',
      failureMode: 'TEST entry: motor failure',
      failureEffect: 'Test-only failure effect',
      sev: 4,
      potentialCauses: 'Test-only potential cause',
      occ: 3,
      currentProcessControls: 'Test-only process control',
      det: 2,
    };
    const result = firstValueFrom(service.createFmeaEntry(partialEntry));
    const request = http.expectOne('/api/fmea/new');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(partialEntry);
    request.flush(entries[0]);
    await expect(result).resolves.toEqual(entries[0]);
  });

  it('reports an HTTP error when an FMEA entry cannot be created', async () => {
    const result = firstValueFrom(service.createFmeaEntry({
      teamId: 'team-1',
      seasonId: 'season-1',
      subsystemId: 'subsystem-1',
      failureMode: 'TEST entry',
      failureEffect: 'Test-only effect',
      sev: 1,
      potentialCauses: 'Test-only cause',
      occ: 1,
      currentProcessControls: 'Test-only control',
      det: 1,
    }));
    http.expectOne('/api/fmea/new').flush({}, { status: 400, statusText: 'Bad Request' });
    await expect(result).rejects.toThrow('Unable to create FMEA item (400).');
  });

  it('deletes an FMEA entry by id', async () => {
    const result = firstValueFrom(service.deleteFmeaEntry('entry-1'));
    const request = http.expectOne('/api/fmea/entry-1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    await expect(result).resolves.toBeUndefined();
  });

  it('reports an HTTP error when an FMEA entry cannot be deleted', async () => {
    const result = firstValueFrom(service.deleteFmeaEntry('entry-1'));
    http.expectOne('/api/fmea/entry-1').flush({}, { status: 500, statusText: 'Server Error' });
    await expect(result)
      .rejects.toThrow('Unable to delete FMEA item (500).');
  });

  it('notifies readiness subscribers after successful creates, updates, and deletes', async () => {
    const changes: void[] = [];
    const subscription = service.fmeaEntriesChanged$.subscribe(() => changes.push(undefined));
    const partialEntry: CreateFmeaEntryRequest = {
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
    };

    const createResult = firstValueFrom(service.createFmeaEntry(partialEntry));
    http.expectOne('/api/fmea/new').flush(entries[0]);
    await createResult;
    const updateResult = firstValueFrom(service.updateFmeaEntry('entry-1', partialEntry));
    const updateRequest = http.expectOne('/api/fmea/entry-1');
    expect(updateRequest.request.method).toBe('PATCH');
    updateRequest.flush(entries[0]);
    await updateResult;
    const deleteResult = firstValueFrom(service.deleteFmeaEntry('entry-1'));
    http.expectOne('/api/fmea/entry-1').flush(null);
    await deleteResult;
    subscription.unsubscribe();

    expect(changes).toHaveLength(3);
  });
});

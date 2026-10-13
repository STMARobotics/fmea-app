import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { SeasonService } from './season.service';

describe('SeasonService', () => {
  let service: SeasonService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SeasonService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('maps API season fields into the app season model', async () => {
    const result = firstValueFrom(service.getAllSeasons());
    http.expectOne('/api/seasons').flush([
      { id: 'season-1', program: 'frc', name: 'Reefscape' },
    ]);
    await expect(result).resolves.toEqual([{ id: 'season-1', program: 'frc', name: 'Reefscape' }]);
  });

  it('creates a season through the API', async () => {
    const season = { id: 'season-1', program: 'frc' as const, name: 'Reefscape' };
    const result = firstValueFrom(service.createSeason({
      program: season.program,
      name: season.name,
    }));
    const request = http.expectOne('/api/seasons');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ program: 'frc', name: 'Reefscape' });
    request.flush(season);
    await expect(result).resolves.toEqual(season);
  });

  it('loads an individual season through the API', async () => {
    const season = { id: 'season-1', program: 'frc' as const, name: 'Reefscape' };
    const result = firstValueFrom(service.getSeason('season-1'));
    http.expectOne('/api/seasons/season-1').flush(season);
    await expect(result).resolves.toEqual(season);
  });

  it('updates a season through the API', async () => {
    const season = { id: 'season-1', program: 'frc' as const, name: 'Reefscape' };
    const result = firstValueFrom(service.updateSeason('season-1', {
      name: 'Reefscape',
    }));
    const request = http.expectOne('/api/seasons/season-1');
    expect(request.request.method).toBe('PATCH');
    request.flush(season);
    await expect(result).resolves.toEqual(season);
  });

  it('deletes a season through the API', async () => {
    const result = firstValueFrom(service.deleteSeason('season-1'));
    const request = http.expectOne('/api/seasons/season-1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    await expect(result).resolves.toBeUndefined();
  });
});

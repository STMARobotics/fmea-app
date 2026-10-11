import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SeasonService } from './season.service';

describe('SeasonService', () => {
  let service: SeasonService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SeasonService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps API season fields into the app season model', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 'season-1', program: 'frc', name: 'Reefscape' },
      ]),
    }));

    await expect(firstValueFrom(service.getAllSeasons())).resolves.toEqual([
      { id: 'season-1', program: 'frc', name: 'Reefscape' },
    ]);
  });

  it('creates a season through the API', async () => {
    const season = { id: 'season-1', program: 'frc' as const, name: 'Reefscape' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(season),
    }));

    await expect(firstValueFrom(service.createSeason({
      program: season.program,
      name: season.name,
    }))).resolves.toEqual(season);
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/seasons', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ program: 'frc', name: 'Reefscape' }),
    }));
  });

  it('loads an individual season through the API', async () => {
    const season = { id: 'season-1', program: 'frc' as const, name: 'Reefscape' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(season),
    }));

    await expect(firstValueFrom(service.getSeason('season-1'))).resolves.toEqual(season);
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/seasons/season-1', expect.any(Object));
  });

  it('updates a season through the API', async () => {
    const season = { id: 'season-1', program: 'frc' as const, name: 'Reefscape' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(season),
    }));

    await expect(firstValueFrom(service.updateSeason('season-1', {
      name: 'Reefscape',
    }))).resolves.toEqual(season);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/seasons/season-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Reefscape' }),
      })
    );
  });

  it('deletes a season through the API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(''),
    }));

    await expect(firstValueFrom(service.deleteSeason('season-1'))).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/seasons/season-1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});

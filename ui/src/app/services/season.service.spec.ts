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
      json: () => Promise.resolve([
        { id: 'season-1', program: 'frc', season_name: 'Reefscape' },
      ]),
    }));

    await expect(firstValueFrom(service.getAllSeasons())).resolves.toEqual([
      { id: 'season-1', program: 'frc', name: 'Reefscape' },
    ]);
  });
});

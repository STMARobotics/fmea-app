import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { FmeaSelectionService } from './fmea-selection.service';

describe('FmeaSelectionService', () => {
  let service: FmeaSelectionService;

  beforeEach(() => {
    localStorage.removeItem('fmea.selectedTeamId');
    localStorage.removeItem('fmea.selectedSeasonId');
    TestBed.configureTestingModule({});
    service = TestBed.inject(FmeaSelectionService);
  });

  it('publishes team changes and clears the selected season', () => {
    const teamValues: (string | null)[] = [];
    const seasonValues: (string | null)[] = [];
    service.selectedTeamId$.subscribe(value => teamValues.push(value));
    service.selectedSeasonId$.subscribe(value => seasonValues.push(value));

    service.selectSeason('season-1');
    service.selectTeam('team-1');

    expect(teamValues).toEqual([null, 'team-1']);
    expect(seasonValues).toEqual([null, 'season-1', null]);
    expect(localStorage.getItem('fmea.selectedTeamId')).toBe('team-1');
    expect(localStorage.getItem('fmea.selectedSeasonId')).toBeNull();
  });

  it('publishes season changes', async () => {
    service.selectSeason('season-1');
    expect(await firstValueFrom(service.selectedSeasonId$)).toBe('season-1');
    expect(localStorage.getItem('fmea.selectedSeasonId')).toBe('season-1');
  });

  it('restores team and season selections from local storage', () => {
    localStorage.setItem('fmea.selectedTeamId', 'team-1');
    localStorage.setItem('fmea.selectedSeasonId', 'season-1');

    const restoredService = new FmeaSelectionService();

    expect(restoredService.selectedTeamId).toBe('team-1');
    expect(restoredService.selectedSeasonId).toBe('season-1');
  });
});

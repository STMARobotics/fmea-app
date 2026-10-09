import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const SELECTED_TEAM_STORAGE_KEY = 'fmea.selectedTeamId';
const SELECTED_SEASON_STORAGE_KEY = 'fmea.selectedSeasonId';

@Injectable({
  providedIn: 'root',
})
export class FmeaSelectionService {
  private readonly selectedTeamIdSubject = new BehaviorSubject<string | null>(
    localStorage.getItem(SELECTED_TEAM_STORAGE_KEY),
  );
  private readonly selectedSeasonIdSubject = new BehaviorSubject<string | null>(
    localStorage.getItem(SELECTED_SEASON_STORAGE_KEY),
  );

  readonly selectedTeamId$ = this.selectedTeamIdSubject.asObservable();
  readonly selectedSeasonId$ = this.selectedSeasonIdSubject.asObservable();

  get selectedTeamId(): string | null {
    return this.selectedTeamIdSubject.value;
  }

  get selectedSeasonId(): string | null {
    return this.selectedSeasonIdSubject.value;
  }

  selectTeam(teamId: string): void {
    this.selectedSeasonIdSubject.next(null);
    this.selectedTeamIdSubject.next(teamId);
    localStorage.removeItem(SELECTED_SEASON_STORAGE_KEY);
    localStorage.setItem(SELECTED_TEAM_STORAGE_KEY, teamId);
  }

  selectSeason(seasonId: string): void {
    this.selectedSeasonIdSubject.next(seasonId);
    localStorage.setItem(SELECTED_SEASON_STORAGE_KEY, seasonId);
  }
}

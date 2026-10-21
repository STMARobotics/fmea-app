import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from "@angular/core";
import { map, Observable, Subject, tap } from "rxjs";
import { withApiError } from './api-error';

export type Season = {
  id: string,
  program: 'ftc' | 'frc',
  name: string
};

@Injectable({
  providedIn: 'root'
})
export class SeasonService {
  private readonly http = inject(HttpClient);
  readonly seasonsChanged$ = new Subject<void>();

  getAllSeasons(): Observable<Season[]> {
    return this.http.get<Season[]>('/api/seasons').pipe(withApiError('Unable to load seasons'));
  }

  getSeason(seasonId: string): Observable<Season> {
    return this.http.get<Season>(`/api/seasons/${encodeURIComponent(seasonId)}`).pipe(
      withApiError('Unable to load season'),
    );
  }

  createSeason(season: Pick<Season, 'program' | 'name'>): Observable<Season> {
    return this.http.post<Season>('/api/seasons', season).pipe(
      withApiError('Unable to create season'),
      tap(() => this.seasonsChanged$.next()),
    );
  }

  updateSeason(
    seasonId: string,
    updates: Partial<Pick<Season, 'program' | 'name'>>
  ): Observable<Season> {
    return this.http.patch<Season>(`/api/seasons/${encodeURIComponent(seasonId)}`, updates).pipe(
      withApiError('Unable to update season'),
      tap(() => this.seasonsChanged$.next()),
    );
  }

  deleteSeason(seasonId: string): Observable<void> {
    return this.http.delete<void>(`/api/seasons/${encodeURIComponent(seasonId)}`).pipe(
      map(() => undefined),
      withApiError('Unable to delete season'),
    );
  }

}

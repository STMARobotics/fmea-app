import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { fromFetch } from "rxjs/fetch";

export type Season = {
  id: string,
  program: 'ftc' | 'frc',
  name: string
};

@Injectable({
  providedIn: 'root'
})
export class SeasonService {

  getAllSeasons(): Observable<Season[]> {
    return fromFetch('/api/seasons', {
      selector: response => {
        if (!response.ok) {
          throw new Error(`Unable to load seasons (${response.status}).`);
        }
        return response.json();
      }
    });
  }

  getSeason(seasonId: string): Observable<Season> {
    return fromFetch(`/api/seasons/${encodeURIComponent(seasonId)}`, {
      selector: response => {
        if (!response.ok) {
          throw new Error(`Unable to load season (${response.status}).`);
        }
        return response.json();
      }
    });
  }

  createSeason(season: Pick<Season, 'program' | 'name'>): Observable<Season> {
    return fromFetch('/api/seasons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(season),
      selector: response => {
        if (!response.ok) {
          throw new Error(`Unable to create season (${response.status}).`);
        }
        return response.json();
      }
    });
  }

  updateSeason(
    seasonId: string,
    updates: Partial<Pick<Season, 'program' | 'name'>>
  ): Observable<Season> {
    return fromFetch(`/api/seasons/${encodeURIComponent(seasonId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
      selector: response => {
        if (!response.ok) {
          throw new Error(`Unable to update season (${response.status}).`);
        }
        return response.json();
      }
    });
  }

  deleteSeason(seasonId: string): Observable<void> {
    return fromFetch(`/api/seasons/${encodeURIComponent(seasonId)}`, {
      method: 'DELETE',
      selector: response => {
        if (!response.ok) {
          throw new Error(`Unable to delete season (${response.status}).`);
        }
        return response.text().then(() => undefined);
      }
    });
  }

}

import { Injectable } from "@angular/core";
import { map, Observable } from "rxjs";
import { fromFetch } from "rxjs/fetch";

@Injectable({
  providedIn: 'root'
})
export class SeasonService {

  getAllSeasons(): Observable<{ id: string, program: 'ftc' | 'frc', name: string }[]> {
    return fromFetch('http://localhost:3000/api/seasons', {
      selector: response => response.json()
    }).pipe(
      map((data: any[]) => data.map(season => ({
        id: season.id,
        program: season.program,
        name: season.season_name
      })))
    );
  }

}

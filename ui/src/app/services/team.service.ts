import { Injectable } from "@angular/core";
import { map, Observable } from "rxjs";
import { fromFetch } from "rxjs/fetch";

@Injectable({
  providedIn: 'root'
})
export class TeamService {

  getAllTeams(): Observable<{ id: string, num: number, name: string, program: 'ftc' | 'frc' }[]> {
    return fromFetch('/api/teams', {
      selector: response => response.json()
    }).pipe(
      map((data: any[]) => data.map(team => ({
        id: team.id,
        num: team.teamNumber,
        name: team.teamName,
        program: team.program
      })))
    );
  }

}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from "@angular/core";
import { map, Observable } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class TeamService {
  private readonly http = inject(HttpClient);

  getAllTeams(): Observable<{ id: string, num: number, name: string, program: 'ftc' | 'frc' }[]> {
    return this.http.get<{ id: string; teamNumber: number; name: string; program: 'ftc' | 'frc' }[]>('/api/teams').pipe(
      map(data => data.map(team => ({
        id: team.id,
        num: team.teamNumber,
        name: team.name,
        program: team.program
      })))
    );
  }

}

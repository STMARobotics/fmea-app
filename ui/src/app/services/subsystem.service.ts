import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

export type Subsystem = {
  id: string;
  teamId: string;
  seasonId: string;
  name: string;
};

@Injectable({
  providedIn: 'root',
})
export class SubsystemService {
  getSubsystemsForTeam(teamId: string): Observable<Subsystem[]> {
    return fromFetch(`http://localhost:3000/api/subsystems/${teamId}`, {
      selector: response => response.json(),
    });
  }
}

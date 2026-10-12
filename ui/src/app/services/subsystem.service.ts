import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

export type Subsystem = {
  id: string;
  teamId: string;
  seasonId: string;
  name: string;
};

export type CreateSubsystemRequest = {
  seasonId: string;
  name: string;
};

@Injectable({
  providedIn: 'root',
})
export class SubsystemService {
  getSubsystemsForTeam(teamId: string): Observable<Subsystem[]> {
    return fromFetch(`/api/subsystems/${encodeURIComponent(teamId)}`, {
      selector: response => {
        if (!response.ok) {
          throw new Error(`Unable to load subsystems (${response.status}).`);
        }
        return response.json();
      },
    });
  }

  createSubsystem(teamId: string, request: CreateSubsystemRequest): Observable<Subsystem> {
    return fromFetch(`/api/subsystems/${encodeURIComponent(teamId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      selector: response => {
        if (!response.ok) {
          throw new Error(`Unable to create subsystem (${response.status}).`);
        }
        return response.json();
      },
    });
  }
}

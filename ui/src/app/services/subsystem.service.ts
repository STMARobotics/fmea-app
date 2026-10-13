import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { withApiError } from './api-error';

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
  private readonly http = inject(HttpClient);

  getSubsystemsForTeam(teamId: string): Observable<Subsystem[]> {
    return this.http.get<Subsystem[]>(`/api/subsystems/${encodeURIComponent(teamId)}`).pipe(
      withApiError('Unable to load subsystems'),
    );
  }

  createSubsystem(teamId: string, request: CreateSubsystemRequest): Observable<Subsystem> {
    return this.http.post<Subsystem>(`/api/subsystems/${encodeURIComponent(teamId)}`, request).pipe(
      withApiError('Unable to create subsystem'),
    );
  }
}

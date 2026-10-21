import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, Subject, tap } from 'rxjs';
import { withApiError } from './api-error';

export type Team = {
  id: string;
  num: number;
  name: string;
  program: 'ftc' | 'frc';
};

export type TeamRequest = {
  program: Team['program'];
  teamNumber: number;
  name: string;
};

type ApiTeam = {
  id: string;
  teamNumber: number;
  name: string;
  program: Team['program'];
};

@Injectable({
  providedIn: 'root'
})
export class TeamService {
  private readonly http = inject(HttpClient);
  readonly teamsChanged$ = new Subject<void>();

  getAllTeams(): Observable<Team[]> {
    return this.http.get<ApiTeam[]>('/api/teams').pipe(
      map(data => data.map(team => this.toTeam(team))),
      withApiError('Unable to load teams'),
    );
  }

  createTeam(request: TeamRequest): Observable<Team> {
    return this.http.post<ApiTeam>('/api/teams', request).pipe(
      map(team => this.toTeam(team)),
      withApiError('Unable to create team'),
      tap(() => this.teamsChanged$.next()),
    );
  }

  updateTeam(teamId: string, updates: Partial<TeamRequest>): Observable<Team> {
    return this.http.patch<ApiTeam>(`/api/teams/${encodeURIComponent(teamId)}`, updates).pipe(
      map(team => this.toTeam(team)),
      withApiError('Unable to update team'),
      tap(() => this.teamsChanged$.next()),
    );
  }

  private toTeam(team: ApiTeam): Team {
    return {
      id: team.id,
      num: team.teamNumber,
      name: team.name,
      program: team.program,
    };
  }
}

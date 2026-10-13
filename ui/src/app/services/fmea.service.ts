import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from "@angular/core";
import { map, Observable, Subject, tap } from "rxjs";
import { withApiError } from './api-error';

export type FmeaEntry = {
  id: string,
  team: {
    id: string,
    program: 'frc' | 'ftc',
    teamNumber: number,
    teamName: string
  },
  subsystem: {
    id: string,
    name: string
  },
  failureMode: string,
  failureEffect: string,
  sev: number,
  potentialCauses: string,
  occ: number,
  currentProcessControls: string,
  det: number,
  lastUpdatedAt: Date,
  actionItems: {
    id: string,
    description: string,
    status: 'not_started' | 'in_progress' | 'assembly_note' | 'complete',
    fmeaEntryId: string,
    lastUpdatedAt: Date
  }[]
};

export type PartialFmeaEntry = {
  subsystemId: string,
  failureMode: string,
  failureEffect: string,
  sev: number,
  potentialCauses: string,
  occ: number,
  currentProcessControls: string,
  det: number
};

export type CreateFmeaEntryRequest = PartialFmeaEntry & {
  teamId: string,
  seasonId: string
};

@Injectable({
  providedIn: 'root'
})
export class FmeaService {
  private readonly http = inject(HttpClient);
  private readonly fmeaEntriesChangedSubject = new Subject<void>();
  readonly fmeaEntriesChanged$ = this.fmeaEntriesChangedSubject.asObservable();

  notifyFmeaEntriesChanged(): void {
    this.fmeaEntriesChangedSubject.next();
  }

  getFmeaEntriesForTeam(teamId: string, seasonId: string): Observable<FmeaEntry[]> {
    return this.http.get<FmeaEntry[]>(`/api/fmea/${encodeURIComponent(teamId)}/${encodeURIComponent(seasonId)}`).pipe(
      withApiError('Unable to load FMEA items'),
    );
  }

  getFmeaEntry(fmeaEntryId: string): Observable<FmeaEntry> {
    return this.http.get<FmeaEntry>(`/api/fmea/${encodeURIComponent(fmeaEntryId)}`).pipe(
      withApiError('Unable to load FMEA item'),
    );
  }

  createFmeaEntry(request: CreateFmeaEntryRequest): Observable<FmeaEntry> {
    return this.http.post<FmeaEntry>('/api/fmea/new', request).pipe(
      withApiError('Unable to create FMEA item'),
      tap(() => this.notifyFmeaEntriesChanged()),
    );
  }

  updateFmeaEntry(fmeaEntryId: string, partialFmeaEntry: PartialFmeaEntry): Observable<FmeaEntry> {
    return this.http.patch<FmeaEntry>(`/api/fmea/${encodeURIComponent(fmeaEntryId)}`, partialFmeaEntry).pipe(
      withApiError('Unable to update FMEA item'),
      tap(() => this.notifyFmeaEntriesChanged()),
    );
  }

  deleteFmeaEntry(fmeaEntryId: string): Observable<void> {
    return this.http.delete<void>(`/api/fmea/${encodeURIComponent(fmeaEntryId)}`).pipe(
      map(() => undefined),
      withApiError('Unable to delete FMEA item'),
      tap(() => this.notifyFmeaEntriesChanged()),
    );
  }

}

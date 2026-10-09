import { Injectable } from "@angular/core";
import { map, Observable, Subject, tap } from "rxjs";
import { fromFetch } from "rxjs/fetch";

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

@Injectable({
  providedIn: 'root'
})
export class FmeaService {
  private readonly fmeaEntriesChangedSubject = new Subject<void>();
  readonly fmeaEntriesChanged$ = this.fmeaEntriesChangedSubject.asObservable();

  notifyFmeaEntriesChanged(): void {
    this.fmeaEntriesChangedSubject.next();
  }

  getFmeaEntriesForTeam(teamId: string, seasonId: string): Observable<FmeaEntry[]> {
    return fromFetch(`http://localhost:3000/api/fmea/${teamId}/${seasonId}`, {
      selector: response => {
        if (!response.ok) {
          throw new Error(`Unable to load FMEA items (${response.status}).`);
        }
        return response.json();
      }
    });
  }

  getFmeaEntry(fmeaEntryId: string): Observable<FmeaEntry> {
    return fromFetch(`http://localhost:3000/api/fmea/${fmeaEntryId}`, {
      selector: response => {
        if (!response.ok) {
          throw new Error(`Unable to load FMEA item (${response.status}).`);
        }
        return response.json();
      }
    });
  }

  createFmeaEntry(partialFmeaEntry: PartialFmeaEntry): Observable<FmeaEntry> {
    return fromFetch('http://localhost:3000/api/fmea/new', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(partialFmeaEntry),
      selector: response => {
        if (!response.ok) {
          throw new Error(`Unable to create FMEA item (${response.status}).`);
        }
        return response.json();
      },
    }).pipe(tap(() => this.notifyFmeaEntriesChanged()));
  }

  updateFmeaEntry(fmeaEntryId: string, partialFmeaEntry: PartialFmeaEntry): Observable<FmeaEntry> {
    return fromFetch(`http://localhost:3000/api/fmea/${fmeaEntryId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(partialFmeaEntry),
      selector: response => {
        if (!response.ok) {
          throw new Error(`Unable to update FMEA item (${response.status}).`);
        }
        return response.json();
      }
    }).pipe(tap(() => this.notifyFmeaEntriesChanged()));
  }

  deleteFmeaEntry(fmeaEntryId: string): Observable<void> {
    return fromFetch(`http://localhost:3000/api/fmea/${fmeaEntryId}`, {
      method: 'DELETE',
      selector: response => {
        if (!response.ok) {
          throw new Error(`Unable to delete FMEA item (${response.status}).`);
        }
        return response.text().then(() => undefined);
      }
    }).pipe(tap(() => this.notifyFmeaEntriesChanged()));
  }

}

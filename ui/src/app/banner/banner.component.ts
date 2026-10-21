import { Component, EventEmitter, inject, Output } from "@angular/core";
import { AsyncPipe } from "@angular/common";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { TeamService } from "../services/team.service";
import { BehaviorSubject, catchError, combineLatest, map, Observable, of, shareReplay, startWith, switchMap } from "rxjs";
import { SeasonService } from "../services/season.service";
import { FmeaEntry, FmeaService } from "../services/fmea.service";
import { FmeaSelectionService } from "../services/fmea-selection.service";

type EventReadiness = {
  level: 'not-event-ready' | 'event-ready' | 'einstein-ready' | 'unavailable';
  label: 'Not event ready' | 'Event ready' | 'Einstein ready' | 'da Vinci ready' | 'Readiness unavailable';
};

@Component({
  imports: [
    AsyncPipe,
    MatInputModule,
    MatSelectModule,
    MatFormFieldModule,
    RouterLink,
    RouterLinkActive,
  ],
  selector: 'banner',
  styleUrl: './banner.component.scss',
  templateUrl: './banner.component.html'
})
export class BannerComponent {

  @Output() teamChange = new EventEmitter<string>();
  @Output() seasonChange = new EventEmitter<string>();

  teamService = inject(TeamService);
  seasonService = inject(SeasonService);
  private readonly fmeaSelection = inject(FmeaSelectionService);
  private readonly fmeaService = inject(FmeaService);

  selectedTeamId = this.fmeaSelection.selectedTeamId;
  selectedSeasonId = this.fmeaSelection.selectedSeasonId;

  private readonly selectedTeamId$ = new BehaviorSubject<string | null>(this.selectedTeamId);
  private readonly selectedSeasonId$ = new BehaviorSubject<string | null>(this.selectedSeasonId);

  teams$: Observable<{ id: string, num: number, name: string, program: 'ftc' | 'frc' }[]> =
    this.teamService.getAllTeams().pipe(shareReplay({ bufferSize: 1, refCount: true }));

  seasons$: Observable<{ id: string, program: 'ftc' | 'frc', name: string }[]> = combineLatest([
    this.seasonService.getAllSeasons(),
    this.selectedTeamId$,
    this.teams$,
  ]).pipe(
    map(([seasons, selectedTeamId, teams]) => {
      const selectedTeam = teams.find(team => team.id === selectedTeamId);
      return selectedTeam
        ? seasons.filter(season => season.program === selectedTeam.program)
        : seasons;
    })
  );

  readonly eventReadiness$: Observable<EventReadiness | null> = combineLatest([
    this.selectedTeamId$,
    this.selectedSeasonId$,
    this.teams$,
    this.fmeaService.fmeaEntriesChanged$.pipe(startWith(undefined)),
  ]).pipe(
    switchMap(([teamId, seasonId, teams]) => {
      const selectedTeam = teams.find(team => team.id === teamId);
      return teamId && seasonId && selectedTeam
        ? this.fmeaService.getFmeaEntriesForTeam(teamId, seasonId).pipe(
            map(entries => this.eventReadinessFor(entries, selectedTeam.program)),
            catchError(() => of<EventReadiness>({
              level: 'unavailable',
              label: 'Readiness unavailable',
            })),
          )
        : of(null);
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  onTeamSelected(teamId: string | null): void {
    if (teamId !== this.selectedTeamId) {
      this.selectedSeasonId = null;
    }
    this.selectedSeasonId$.next(this.selectedSeasonId);
    this.selectedTeamId = teamId;
    this.selectedTeamId$.next(teamId);
    if (teamId !== null) {
      this.teamChange.emit(teamId);
    }
  }

  onSeasonSelected(seasonId: string | null): void {
    this.selectedSeasonId = seasonId;
    this.selectedSeasonId$.next(seasonId);
    if (seasonId !== null) {
      this.seasonChange.emit(seasonId);
    }
  }

  private eventReadinessFor(entries: FmeaEntry[], program: 'ftc' | 'frc'): EventReadiness | null {
    if (entries.length === 0) {
      return null;
    }

    const criticalCount = entries.filter(entry => this.rpnFor(entry) > 300).length;
    const moderateCount = entries.filter(entry => {
      const rpn = this.rpnFor(entry);
      return rpn > 100 && rpn <= 300;
    }).length;

    if (criticalCount > 0 || moderateCount >= 3 || moderateCount / entries.length >= 0.25) {
      return { level: 'not-event-ready', label: 'Not event ready' };
    }
    if (moderateCount > 0) {
      return { level: 'event-ready', label: 'Event ready' };
    }
    return {
      level: 'einstein-ready',
      label: program === 'frc' ? 'Einstein ready' : 'da Vinci ready',
    };
  }

  private rpnFor(entry: FmeaEntry): number {
    return entry.sev * entry.occ * entry.det;
  }
}

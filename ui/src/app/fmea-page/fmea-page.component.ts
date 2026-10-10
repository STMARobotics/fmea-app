import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, map, Observable, of, shareReplay, switchMap } from 'rxjs';
import { FmeaEntryCardComponent } from '../fmea-entry-card/fmea-entry-card.component';
import { FmeaEntry, FmeaService } from '../services/fmea.service';
import { ActionItemFilter, FmeaEntrySort, FmeaListStateService } from '../services/fmea-list-state.service';
import { FmeaSelectionService } from '../services/fmea-selection.service';
import { SubsystemService } from '../services/subsystem.service';

@Component({
  imports: [AsyncPipe, FmeaEntryCardComponent, MatFormFieldModule, MatSelectModule, RouterLink],
  selector: 'app-fmea-page',
  styleUrl: './fmea-page.component.scss',
  templateUrl: './fmea-page.component.html',
})
export class FmeaPageComponent {
  private readonly fmeaService = inject(FmeaService);
  private readonly listState = inject(FmeaListStateService);
  private readonly fmeaSelection = inject(FmeaSelectionService);
  private readonly subsystemService = inject(SubsystemService);

  selectedSubsystem = this.listState.selectedSubsystem;
  selectedSort = this.listState.selectedSort;
  actionItemFilter = this.listState.actionItemFilter;
  readonly selectedTeamId$ = this.fmeaSelection.selectedTeamId$;
  readonly selectedSeasonId$ = this.fmeaSelection.selectedSeasonId$;

  constructor() {
    const route = inject(ActivatedRoute);
    const router = inject(Router);
    if (['subsystem', 'sort', 'actionItems'].some(key => route.snapshot.queryParamMap.has(key))) {
      void router.navigate([], {
        relativeTo: route,
        queryParams: { subsystem: null, sort: null, actionItems: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  readonly fmeaEntries$: Observable<FmeaEntry[]> = combineLatest([
    this.fmeaSelection.selectedTeamId$,
    this.fmeaSelection.selectedSeasonId$,
  ]).pipe(
    switchMap(([teamId, seasonId]) => {
      this.listState.setSelectionScope(teamId, seasonId);
      this.selectedSubsystem = this.listState.selectedSubsystem;
      return teamId && seasonId ? this.fmeaService.getFmeaEntriesForTeam(teamId, seasonId) : of([]);
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly subsystemNames$: Observable<string[]> = combineLatest([
    this.fmeaSelection.selectedTeamId$,
    this.fmeaSelection.selectedSeasonId$,
  ]).pipe(
    switchMap(([teamId, seasonId]) =>
      teamId && seasonId
        ? this.subsystemService.getSubsystemsForTeam(teamId).pipe(
            map(subsystems => subsystems.filter(subsystem => subsystem.seasonId === seasonId)),
          )
        : of([]),
    ),
    map(subsystems => [...new Set(subsystems.map(subsystem => subsystem.name))].sort((a, b) => a.localeCompare(b))),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private readonly filteredFmeaEntries$: Observable<FmeaEntry[]> = combineLatest([
    this.fmeaEntries$,
    this.listState.selectedSubsystem$,
    this.listState.actionItemFilter$,
  ]).pipe(
    map(([entries, subsystem, actionItemFilter]) =>
      entries.filter(entry =>
        (!subsystem || entry.subsystem.name === subsystem) &&
        this.matchesActionItemFilter(entry, actionItemFilter),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly displayedFmeaEntries$: Observable<FmeaEntry[]> = combineLatest([
    this.filteredFmeaEntries$,
    this.listState.selectedSort$,
  ]).pipe(
    map(([entries, sort]) =>
      [...entries].sort((left, right) => {
        if (sort === 'subsystem') {
          const subsystemOrder = left.subsystem.name.localeCompare(right.subsystem.name);
          if (subsystemOrder !== 0) {
            return subsystemOrder;
          }
        }

        if (sort === 'last-updated-asc') {
          return this.lastUpdatedTimeFor(left) - this.lastUpdatedTimeFor(right);
        }
        if (sort === 'last-updated-desc') {
          return this.lastUpdatedTimeFor(right) - this.lastUpdatedTimeFor(left);
        }

        return this.rpnFor(right) - this.rpnFor(left);
      }),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  onSubsystemSelected(subsystem: string): void {
    this.selectedSubsystem = subsystem;
    this.listState.setSubsystem(subsystem);
  }

  onSortSelected(sort: FmeaEntrySort): void {
    this.selectedSort = sort;
    this.listState.setSort(sort);
  }

  onActionItemFilterSelected(filter: ActionItemFilter): void {
    this.actionItemFilter = filter;
    this.listState.setActionItemFilter(filter);
  }

  onResetFilters(): void {
    this.listState.reset();
    this.selectedSubsystem = this.listState.selectedSubsystem;
    this.selectedSort = this.listState.selectedSort;
    this.actionItemFilter = this.listState.actionItemFilter;
  }

  private rpnFor(entry: FmeaEntry): number {
    return entry.sev * entry.occ * entry.det;
  }

  private lastUpdatedTimeFor(entry: FmeaEntry): number {
    return Date.parse(entry.lastUpdatedAt.toString());
  }

  private matchesActionItemFilter(entry: FmeaEntry, filter: ActionItemFilter): boolean {
    switch (filter) {
      case 'moderate-critical-no-active':
        return this.rpnFor(entry) > 100 &&
          !entry.actionItems.some(actionItem => actionItem.status !== 'complete');
      case 'not_started':
      case 'in_progress':
      case 'assembly_note':
        return entry.actionItems.some(actionItem => actionItem.status === filter);
      case 'all':
        return true;
    }
  }
}

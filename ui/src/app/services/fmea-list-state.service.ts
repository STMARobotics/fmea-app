import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ActionItemFilter = 'all' | 'moderate-critical-no-active' | 'not_started' | 'in_progress' | 'assembly_note';
export type FmeaEntrySort = 'rpn' | 'subsystem' | 'last-updated-asc' | 'last-updated-desc';

@Injectable({
  providedIn: 'root',
})
export class FmeaListStateService {
  private readonly selectedSubsystemSubject = new BehaviorSubject('');
  private readonly actionItemsSubsystemSubject = new BehaviorSubject('');
  private readonly selectedSortSubject = new BehaviorSubject<FmeaEntrySort>('rpn');
  private readonly actionItemFilterSubject = new BehaviorSubject<ActionItemFilter>('all');
  private selectionScope: { teamId: string; seasonId: string } | null = null;

  readonly selectedSubsystem$ = this.selectedSubsystemSubject.asObservable();
  readonly actionItemsSubsystem$ = this.actionItemsSubsystemSubject.asObservable();
  readonly selectedSort$ = this.selectedSortSubject.asObservable();
  readonly actionItemFilter$ = this.actionItemFilterSubject.asObservable();

  get selectedSubsystem(): string {
    return this.selectedSubsystemSubject.value;
  }

  get actionItemsSubsystem(): string {
    return this.actionItemsSubsystemSubject.value;
  }

  get selectedSort(): FmeaEntrySort {
    return this.selectedSortSubject.value;
  }

  get actionItemFilter(): ActionItemFilter {
    return this.actionItemFilterSubject.value;
  }

  setSubsystem(subsystem: string): void {
    this.selectedSubsystemSubject.next(subsystem);
  }

  setActionItemsSubsystem(subsystem: string): void {
    this.actionItemsSubsystemSubject.next(subsystem);
  }

  setSort(sort: FmeaEntrySort): void {
    this.selectedSortSubject.next(sort);
  }

  setActionItemFilter(filter: ActionItemFilter): void {
    this.actionItemFilterSubject.next(filter);
  }

  reset(): void {
    this.setSubsystem('');
    this.setSort('rpn');
    this.setActionItemFilter('all');
  }

  setSelectionScope(teamId: string | null, seasonId: string | null): void {
    if (!teamId || !seasonId) {
      return;
    }

    if (this.selectionScope &&
        (this.selectionScope.teamId !== teamId || this.selectionScope.seasonId !== seasonId)) {
      this.setSubsystem('');
      this.setActionItemsSubsystem('');
    }

    this.selectionScope = { teamId, seasonId };
  }
}

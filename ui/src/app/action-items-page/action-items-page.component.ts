import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { catchError, combineLatest, map, Observable, of, startWith, switchMap, tap } from 'rxjs';
import { ActionItemService, ActionItemStatus, PartialActionItem } from '../services/action-item.service';
import { FmeaEntry, FmeaService } from '../services/fmea.service';
import { FmeaListStateService } from '../services/fmea-list-state.service';
import { FmeaSelectionService } from '../services/fmea-selection.service';

type ActionItemView = {
  id: string;
  description: string;
  status: FmeaEntry['actionItems'][number]['status'];
  lastUpdatedAt: Date;
  fmeaEntryId: string;
  failureMode: string;
  subsystem: string;
};

type ActionItemsColumn = {
  status: ActionItemStatus;
  title: string;
  actionItems: ActionItemView[];
};

type ActionItemsPageState =
  | { kind: 'selection-required' }
  | { kind: 'loading' }
  | { kind: 'loaded'; actionItems: ActionItemView[]; columns: ActionItemsColumn[] }
  | { kind: 'error'; message: string };

@Component({
  imports: [AsyncPipe, DatePipe, MatFormFieldModule, MatSelectModule, RouterLink],
  selector: 'app-action-items-page',
  styleUrl: './action-items-page.component.scss',
  templateUrl: './action-items-page.component.html',
})
export class ActionItemsPageComponent {
  private readonly actionItemService = inject(ActionItemService);
  private readonly fmeaService = inject(FmeaService);
  private readonly listState = inject(FmeaListStateService);
  private readonly fmeaSelection = inject(FmeaSelectionService);

  readonly selectedSubsystem = signal(this.listState.actionItemsSubsystem);
  readonly savingActionItemIds = signal(new Set<string>());
  readonly statusUpdateError = signal<string | null>(null);
  readonly draggedActionItem = signal<ActionItemView | null>(null);
  readonly dragTargetStatus = signal<ActionItemStatus | null>(null);
  readonly statusOptions: Pick<ActionItemsColumn, 'status' | 'title'>[] = [
    { status: 'assembly_note', title: 'Assembly notes' },
    { status: 'not_started', title: 'Not started' },
    { status: 'in_progress', title: 'In progress' },
    { status: 'complete', title: 'Complete' },
  ];

  readonly state$: Observable<ActionItemsPageState> = combineLatest([
    this.fmeaSelection.selectedTeamId$,
    this.fmeaSelection.selectedSeasonId$,
    this.fmeaService.fmeaEntriesChanged$.pipe(startWith(undefined)),
  ]).pipe(
    tap(([teamId, seasonId]) => {
      this.listState.setSelectionScope(teamId, seasonId);
      this.selectedSubsystem.set(this.listState.actionItemsSubsystem);
    }),
    switchMap(([teamId, seasonId]) => {
      if (!teamId || !seasonId) {
        return of<ActionItemsPageState>({ kind: 'selection-required' });
      }

      return this.fmeaService.getFmeaEntriesForTeam(teamId, seasonId).pipe(
        map(entries => {
          const actionItems = entries.flatMap(entry =>
            entry.actionItems.map(actionItem => ({
              ...actionItem,
              failureMode: entry.failureMode,
              fmeaEntryId: entry.id,
              subsystem: entry.subsystem.name,
            })),
          );
          return {
            kind: 'loaded' as const,
            actionItems,
            columns: this.statusOptions.map(column => ({
              ...column,
              actionItems: actionItems.filter(item => item.status === column.status),
            })),
          };
        }),
        startWith<ActionItemsPageState>({ kind: 'loading' }),
        catchError((error: unknown) =>
          of<ActionItemsPageState>({
            kind: 'error',
            message: error instanceof Error ? error.message : 'Unable to load action items.',
          }),
        ),
      );
    }),
  );

  onSubsystemSelected(subsystem: string): void {
    this.selectedSubsystem.set(subsystem);
    this.listState.setActionItemsSubsystem(subsystem);
  }

  filteredItemsFor(items: ActionItemView[]): ActionItemView[] {
    const selectedSubsystem = this.selectedSubsystem();
    return selectedSubsystem
      ? items.filter(item => item.subsystem === selectedSubsystem)
      : items;
  }

  subsystemNamesFor(items: ActionItemView[]): string[] {
    return [...new Set(items.map(item => item.subsystem))]
      .sort((left, right) => left.localeCompare(right));
  }

  isSaving(actionItemId: string): boolean {
    return this.savingActionItemIds().has(actionItemId);
  }

  onDragStart(item: ActionItemView, event: DragEvent): void {
    this.draggedActionItem.set(item);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', item.id);
    }
  }

  onDragOver(status: ActionItemStatus, event: DragEvent): void {
    event.preventDefault();
    this.dragTargetStatus.set(status);
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDrop(status: ActionItemStatus, event: DragEvent): void {
    event.preventDefault();
    const item = this.draggedActionItem();
    this.draggedActionItem.set(null);
    this.dragTargetStatus.set(null);
    if (item) {
      this.updateStatus(item, status);
    }
  }

  onDragEnd(): void {
    this.draggedActionItem.set(null);
    this.dragTargetStatus.set(null);
  }

  private updateStatus(item: ActionItemView, status: ActionItemStatus): void {
    if (item.status === status || this.isSaving(item.id)) {
      return;
    }

    const update: PartialActionItem = {
      description: item.description,
      status,
      fmeaEntryId: item.fmeaEntryId,
    };
    this.statusUpdateError.set(null);
    this.savingActionItemIds.update(ids => new Set(ids).add(item.id));
    this.actionItemService.updateActionItem(item.id, update).subscribe({
      error: (error: unknown) => {
        this.savingActionItemIds.update(ids => {
          const updatedIds = new Set(ids);
          updatedIds.delete(item.id);
          return updatedIds;
        });
        this.statusUpdateError.set(
          error instanceof Error ? error.message : 'Unable to update action item.',
        );
      },
      complete: () => {
        this.savingActionItemIds.update(ids => {
          const updatedIds = new Set(ids);
          updatedIds.delete(item.id);
          return updatedIds;
        });
      },
    });
  }
}

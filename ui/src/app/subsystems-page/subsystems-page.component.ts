import { AsyncPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, catchError, combineLatest, firstValueFrom, map, Observable, of, startWith, switchMap } from 'rxjs';
import { FmeaSelectionService } from '../services/fmea-selection.service';
import { Subsystem, SubsystemService } from '../services/subsystem.service';

type SubsystemsState =
  | { kind: 'selection-required' }
  | { kind: 'loading' }
  | { kind: 'loaded'; subsystems: Subsystem[] }
  | { kind: 'error'; message: string };

@Component({
  imports: [AsyncPipe, ReactiveFormsModule],
  selector: 'app-subsystems-page',
  styleUrl: './subsystems-page.component.scss',
  templateUrl: './subsystems-page.component.html',
})
export class SubsystemsPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly fmeaSelection = inject(FmeaSelectionService);
  private readonly subsystemService = inject(SubsystemService);
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  readonly selectedTeamId$ = this.fmeaSelection.selectedTeamId$;
  readonly selectedSeasonId$ = this.fmeaSelection.selectedSeasonId$;
  readonly editingSubsystemId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly createForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
  });
  readonly editForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
  });

  readonly state$: Observable<SubsystemsState> = combineLatest([
    this.selectedTeamId$,
    this.selectedSeasonId$,
    this.refresh$,
  ]).pipe(
    switchMap(([teamId, seasonId]) => {
      if (!teamId || !seasonId) {
        return of<SubsystemsState>({ kind: 'selection-required' });
      }
      return this.subsystemService.getSubsystemsForTeam(teamId).pipe(
        map(subsystems => ({
          kind: 'loaded',
          subsystems: subsystems
            .filter(subsystem => subsystem.seasonId === seasonId)
            .sort((left, right) => left.name.localeCompare(right.name)),
        }) as const),
        startWith<SubsystemsState>({ kind: 'loading' }),
        catchError((error: unknown) => of<SubsystemsState>({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Unable to load subsystems.',
        })),
      );
    }),
  );

  editSubsystem(subsystem: Subsystem): void {
    this.clearMessages();
    this.editingSubsystemId.set(subsystem.id);
    this.editForm.setValue({ name: subsystem.name });
  }

  cancelEdit(): void {
    this.editingSubsystemId.set(null);
    this.editForm.reset({ name: '' });
  }

  async addSubsystem(): Promise<void> {
    if (this.createForm.invalid || this.saving()) {
      this.createForm.markAllAsTouched();
      return;
    }
    const [teamId, seasonId] = [
      this.fmeaSelection.selectedTeamId,
      this.fmeaSelection.selectedSeasonId,
    ];
    if (!teamId || !seasonId) {
      this.errorMessage.set('Select a team and season before adding a subsystem.');
      return;
    }
    this.saving.set(true);
    this.clearMessages();
    try {
      await firstValueFrom(this.subsystemService.createSubsystem(teamId, {
        seasonId,
        name: this.createForm.controls.name.value.trim(),
      }));
      this.createForm.reset({ name: '' });
      this.successMessage.set('Subsystem added.');
      this.refresh$.next();
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'Unable to add subsystem.'));
    } finally {
      this.saving.set(false);
    }
  }

  async saveSubsystem(subsystemId: string): Promise<void> {
    if (this.editForm.invalid || this.saving()) {
      this.editForm.markAllAsTouched();
      return;
    }
    const teamId = this.fmeaSelection.selectedTeamId;
    if (!teamId) {
      this.errorMessage.set('Select a team before editing a subsystem.');
      return;
    }
    this.saving.set(true);
    this.clearMessages();
    try {
      await firstValueFrom(this.subsystemService.updateSubsystem(
        teamId,
        subsystemId,
        this.editForm.controls.name.value.trim(),
      ));
      this.cancelEdit();
      this.successMessage.set('Subsystem updated.');
      this.refresh$.next();
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'Unable to update subsystem.'));
    } finally {
      this.saving.set(false);
    }
  }

  private clearMessages(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  private errorText(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}

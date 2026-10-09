import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, combineLatest, firstValueFrom, map, Observable, of, startWith, switchMap } from 'rxjs';
import { RatingCheatSheetComponent } from '../rating-cheat-sheet/rating-cheat-sheet.component';
import { FmeaSelectionService } from '../services/fmea-selection.service';
import { FmeaEntry, FmeaService, PartialFmeaEntry } from '../services/fmea.service';
import { NavigationHistoryService } from '../services/navigation-history.service';
import { Subsystem, SubsystemService } from '../services/subsystem.service';

type SubsystemState =
  | { kind: 'unavailable' }
  | { kind: 'unselected' }
  | { kind: 'loaded'; subsystems: Subsystem[] }
  | { kind: 'error'; message: string };

@Component({
  imports: [AsyncPipe, RatingCheatSheetComponent, ReactiveFormsModule, RouterLink],
  selector: 'app-fmea-entry-create-page',
  styleUrl: './fmea-entry-create-page.component.scss',
  templateUrl: './fmea-entry-create-page.component.html',
})
export class FmeaEntryCreatePageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly fmeaSelection = inject(FmeaSelectionService);
  private readonly fmeaService = inject(FmeaService);
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly subsystemService = inject(SubsystemService);

  readonly selectedTeamId$ = this.fmeaSelection.selectedTeamId$;
  readonly selectedSeasonId$ = this.fmeaSelection.selectedSeasonId$;
  readonly form = this.formBuilder.nonNullable.group({
    subsystemId: ['', Validators.required],
    failureMode: ['', Validators.required],
    failureEffect: ['', Validators.required],
    sev: this.formBuilder.nonNullable.control<number | null>(null, [Validators.required, Validators.min(1), Validators.max(10), Validators.pattern(/^(?:[1-9]|10)$/)]),
    potentialCauses: ['', Validators.required],
    occ: this.formBuilder.nonNullable.control<number | null>(null, [Validators.required, Validators.min(1), Validators.max(10), Validators.pattern(/^(?:[1-9]|10)$/)]),
    currentProcessControls: ['', Validators.required],
    det: this.formBuilder.nonNullable.control<number | null>(null, [Validators.required, Validators.min(1), Validators.max(10), Validators.pattern(/^(?:[1-9]|10)$/)]),
  });

  readonly subsystemState$: Observable<SubsystemState> = combineLatest([
    this.selectedTeamId$,
    this.selectedSeasonId$,
  ]).pipe(
    switchMap(([teamId, seasonId]) => {
      if (!teamId || !seasonId) {
        return of<SubsystemState>({ kind: 'unselected' });
      }

      return this.subsystemService.getSubsystemsForTeam(teamId).pipe(
        map(subsystems => ({
          kind: 'loaded',
          subsystems: subsystems.filter(subsystem => subsystem.seasonId === seasonId),
        }) as const),
        catchError(error => of<SubsystemState>({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Unable to load subsystems.',
        })),
        startWith<SubsystemState>({ kind: 'unavailable' }),
      );
    }),
  );

  submitting = false;
  submissionError = '';

  async onSubmit(): Promise<void> {
    const formValue = this.form.getRawValue();
    if (this.form.invalid || this.submitting || formValue.sev === null || formValue.occ === null || formValue.det === null) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.submissionError = '';

    try {
      const payload: PartialFmeaEntry = { ...formValue, sev: formValue.sev, occ: formValue.occ, det: formValue.det };
      const entry: FmeaEntry = await firstValueFrom(this.fmeaService.createFmeaEntry(payload));
      await this.navigationHistory.navigateReplacingCurrent(`/fmea/${entry.id}`);
    } catch (error) {
      this.submissionError = error instanceof Error ? error.message : 'Unable to create this FMEA entry.';
    } finally {
      this.submitting = false;
    }
  }
}

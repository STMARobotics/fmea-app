import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { catchError, distinctUntilChanged, firstValueFrom, map, Observable, of, startWith, switchMap } from 'rxjs';
import { RatingCheatSheetComponent } from '../rating-cheat-sheet/rating-cheat-sheet.component';
import { ActionItemService } from '../services/action-item.service';
import { FmeaEntry, FmeaService, PartialFmeaEntry } from '../services/fmea.service';
import { NavigationHistoryService } from '../services/navigation-history.service';
import { DeleteFmeaEntryDialogComponent } from './delete-fmea-entry-dialog.component';

type DetailState =
  | { kind: 'loading' }
  | { kind: 'loaded'; entry: FmeaEntry }
  | { kind: 'error'; message: string };

@Component({
  imports: [AsyncPipe, DatePipe, MatCardModule, RatingCheatSheetComponent, ReactiveFormsModule],
  selector: 'app-fmea-entry-detail',
  styleUrl: './fmea-entry-detail.component.scss',
  templateUrl: './fmea-entry-detail.component.html',
})
export class FmeaEntryDetailComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly actionItemService = inject(ActionItemService);
  private readonly fmeaService = inject(FmeaService);
  private readonly navigationHistory = inject(NavigationHistoryService);

  readonly form = this.formBuilder.nonNullable.group({
    failureMode: ['', Validators.required],
    failureEffect: ['', Validators.required],
    sev: [5, [Validators.required, Validators.min(1), Validators.max(10), Validators.pattern(/^(?:[1-9]|10)$/)]],
    potentialCauses: ['', Validators.required],
    occ: [5, [Validators.required, Validators.min(1), Validators.max(10), Validators.pattern(/^(?:[1-9]|10)$/)]],
    currentProcessControls: ['', Validators.required],
    det: [5, [Validators.required, Validators.min(1), Validators.max(10), Validators.pattern(/^(?:[1-9]|10)$/)]],
  });

  editing = false;
  saving = false;
  confirmingDelete = false;
  deleting = false;
  submissionError = '';
  addingActionItem = false;
  creatingActionItem = false;
  newActionItemDescription = '';
  actionItemError = '';
  private updatedEntry: FmeaEntry | null = null;

  readonly detailState$: Observable<DetailState> = this.route.paramMap.pipe(
    map(params => params.get('fmeaEntryId')),
    distinctUntilChanged(),
    switchMap(id => {
      if (!id) {
        return of<DetailState>({ kind: 'error', message: 'No FMEA item was specified.' });
      }

      return this.fmeaService.getFmeaEntry(id).pipe(
        map(entry => entry
          ? { kind: 'loaded', entry } as const
          : { kind: 'error', message: 'No FMEA item was found.' } as const),
        catchError(error => of<DetailState>({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Unable to load this FMEA item.',
        })),
        startWith<DetailState>({ kind: 'loading' }),
      );
    }),
  );

  rpnFor(entry: FmeaEntry): number {
    return entry.sev * entry.occ * entry.det;
  }

  riskLevelFor(entry: FmeaEntry): 'low' | 'moderate' | 'critical' {
    return this.riskLevelForRatings(entry.sev, entry.occ, entry.det);
  }

  riskLevelForRatings(sev: number, occ: number, det: number): 'low' | 'moderate' | 'critical' {
    const rpn = sev * occ * det;
    if (rpn <= 100) {
      return 'low';
    }
    if (rpn <= 300) {
      return 'moderate';
    }
    return 'critical';
  }

  currentRiskLevelFor(entry: FmeaEntry): 'low' | 'moderate' | 'critical' {
    return this.editing
      ? this.riskLevelForRatings(this.form.controls.sev.value, this.form.controls.occ.value, this.form.controls.det.value)
      : this.riskLevelFor(entry);
  }

  currentEntry(entry: FmeaEntry): FmeaEntry {
    return this.updatedEntry?.id === entry.id ? this.updatedEntry : entry;
  }

  toggleActionItemForm(): void {
    this.addingActionItem = !this.addingActionItem;
    this.newActionItemDescription = '';
    this.actionItemError = '';
  }

  setActionItemDescription(event: Event): void {
    this.newActionItemDescription = (event.target as HTMLTextAreaElement).value;
  }

  async createActionItem(entry: FmeaEntry): Promise<void> {
    const description = this.newActionItemDescription.trim();
    if (!description || this.creatingActionItem) {
      return;
    }

    this.creatingActionItem = true;
    this.actionItemError = '';
    try {
      const actionItem = await firstValueFrom(
        this.actionItemService.createActionItem(entry.id, { description }),
      );
      const current = this.currentEntry(entry);
      this.updatedEntry = {
        ...current,
        actionItems: [...current.actionItems, actionItem],
      };
      this.addingActionItem = false;
      this.newActionItemDescription = '';
    } catch (error) {
      this.actionItemError = error instanceof Error ? error.message : 'Unable to create action item.';
    } finally {
      this.creatingActionItem = false;
      this.changeDetectorRef.markForCheck();
    }
  }

  goBack(): void {
    this.navigationHistory.navigateBack('/fmea');
  }

  startEditing(entry: FmeaEntry): void {
    const current = this.currentEntry(entry);
    this.form.reset({
      failureMode: current.failureMode,
      failureEffect: current.failureEffect,
      sev: current.sev,
      potentialCauses: current.potentialCauses,
      occ: current.occ,
      currentProcessControls: current.currentProcessControls,
      det: current.det,
    });
    this.submissionError = '';
    this.editing = true;
  }

  cancelEditing(entry: FmeaEntry): void {
    this.startEditing(entry);
    this.editing = false;
    this.submissionError = '';
  }

  async saveChanges(entry: FmeaEntry): Promise<void> {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.submissionError = '';

    const payload: PartialFmeaEntry = {
      subsystemId: entry.subsystem.id,
      ...this.form.getRawValue(),
    };

    try {
      this.updatedEntry = await firstValueFrom(this.fmeaService.updateFmeaEntry(entry.id, payload));
      this.editing = false;
    } catch (error) {
      this.submissionError = error instanceof Error ? error.message : 'Unable to update this FMEA item.';
    } finally {
      this.saving = false;
      this.changeDetectorRef.markForCheck();
    }
  }

  async deleteEntry(entry: FmeaEntry): Promise<void> {
    if (this.confirmingDelete || this.deleting) {
      return;
    }

    this.confirmingDelete = true;
    this.submissionError = '';

    try {
      const confirmed = await firstValueFrom(this.dialog.open(DeleteFmeaEntryDialogComponent, {
        data: { failureMode: entry.failureMode },
        panelClass: 'fmea-confirmation-dialog',
        backdropClass: 'fmea-confirmation-backdrop',
        width: '440px',
        maxWidth: 'calc(100vw - 32px)',
      }).afterClosed());
      if (confirmed !== true) {
        return;
      }

      this.deleting = true;
      await firstValueFrom(this.fmeaService.deleteFmeaEntry(entry.id));
      await this.router.navigate(['/fmea']);
    } catch (error) {
      this.submissionError = error instanceof Error ? error.message : 'Unable to delete this FMEA item.';
    } finally {
      this.confirmingDelete = false;
      this.deleting = false;
      this.changeDetectorRef.markForCheck();
    }
  }
}

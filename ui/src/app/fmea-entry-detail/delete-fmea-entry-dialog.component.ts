import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

interface DeleteFmeaEntryDialogData {
  failureMode: string;
  itemType?: string;
}

@Component({
  imports: [MatDialogModule],
  selector: 'app-delete-fmea-entry-dialog',
  styleUrl: './delete-fmea-entry-dialog.component.scss',
  templateUrl: './delete-fmea-entry-dialog.component.html',
})
export class DeleteFmeaEntryDialogComponent {
  readonly data = inject<DeleteFmeaEntryDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<DeleteFmeaEntryDialogComponent, boolean>>(MatDialogRef);

  close(confirmed: boolean): void {
    this.dialogRef.close(confirmed);
  }
}

import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

interface DeleteSubsystemDialogData {
  subsystemName: string;
}

@Component({
  imports: [MatDialogModule],
  selector: 'app-delete-subsystem-dialog',
  styleUrl: './delete-subsystem-dialog.component.scss',
  templateUrl: './delete-subsystem-dialog.component.html',
})
export class DeleteSubsystemDialogComponent {
  readonly data = inject<DeleteSubsystemDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<DeleteSubsystemDialogComponent, boolean>>(MatDialogRef);

  close(confirmed: boolean): void {
    this.dialogRef.close(confirmed);
  }
}

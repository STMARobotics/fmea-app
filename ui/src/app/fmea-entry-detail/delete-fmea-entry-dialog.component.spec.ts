import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DeleteFmeaEntryDialogComponent } from './delete-fmea-entry-dialog.component';

describe('DeleteFmeaEntryDialogComponent', () => {
  let fixture: ComponentFixture<DeleteFmeaEntryDialogComponent>;
  const dialogRefMock = { close: vi.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteFmeaEntryDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { failureMode: 'Wheel breaks' } },
        { provide: MatDialogRef, useValue: dialogRefMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteFmeaEntryDialogComponent);
    fixture.detectChanges();
    vi.clearAllMocks();
  });

  it('shows which FMEA entry will be deleted', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Wheel breaks');
  });

  it('closes without confirming when cancelled', () => {
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')?.click();

    expect(dialogRefMock.close).toHaveBeenCalledWith(false);
  });

  it('confirms when deletion is selected', () => {
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button');
    buttons[1].click();

    expect(dialogRefMock.close).toHaveBeenCalledWith(true);
  });
});

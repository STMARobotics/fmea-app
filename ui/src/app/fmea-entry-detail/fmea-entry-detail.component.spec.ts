import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { FmeaEntry, FmeaService } from '../services/fmea.service';
import { NavigationHistoryService } from '../services/navigation-history.service';
import { FmeaEntryDetailComponent } from './fmea-entry-detail.component';

describe('FmeaEntryDetailComponent', () => {
  let fixture: ComponentFixture<FmeaEntryDetailComponent>;
  const routeMock = {
    paramMap: of(convertToParamMap({ fmeaEntryId: 'entry-1' })),
  };
  const fmeaServiceMock = {
    getFmeaEntry: vi.fn(() => of(entry)),
    updateFmeaEntry: vi.fn(() => of(entry)),
    deleteFmeaEntry: vi.fn(() => of(undefined)),
  };
  const routerMock = {
    navigate: vi.fn(() => Promise.resolve(true)),
    createUrlTree: vi.fn(() => ({})),
    serializeUrl: vi.fn(() => '/fmea'),
  };
  const navigationHistoryMock = {
    navigateBack: vi.fn(),
  };
  const dialogMock = {
    open: vi.fn(() => ({ afterClosed: () => of(false) })),
  };
  const entry: FmeaEntry = {
    id: 'entry-1',
    team: { id: 'team-1', program: 'ftc', teamNumber: 14672, teamName: 'Micro Militia' },
    subsystem: { id: 'subsystem-1', name: 'Drivetrain' },
    failureMode: 'Wheel breaks',
    failureEffect: 'The robot may not drive as well.',
    sev: 7,
    potentialCauses: 'Collision with another robot.',
    occ: 5,
    currentProcessControls: 'Inspect the wheel periodically.',
    det: 9,
    lastUpdatedAt: new Date('2026-10-04'),
    actionItems: [{
      id: 'action-1',
      description: 'Add wheel guards.',
      status: 'not_started',
      fmeaEntryId: 'entry-1',
      lastUpdatedAt: new Date('2026-10-04'),
    }],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FmeaEntryDetailComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: routeMock,
        },
        { provide: FmeaService, useValue: fmeaServiceMock },
        { provide: Router, useValue: routerMock },
        { provide: MatDialog, useValue: dialogMock },
        { provide: NavigationHistoryService, useValue: navigationHistoryMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FmeaEntryDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    vi.clearAllMocks();
  });

  it('shows the requested FMEA entry and its additional information', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain('Wheel breaks');
    expect(element.querySelector('.team')?.textContent).toContain('entry-1');
    expect(element.querySelector('.rpn strong')?.textContent).toBe('315');
    expect(element.querySelector('.risk-label')?.textContent).toBe('critical');
    expect(element.textContent).toContain('Collision with another robot.');
    expect(element.textContent).toContain('Inspect the wheel periodically.');
    expect(element.textContent).toContain('Add wheel guards.');
    expect(element.querySelectorAll('app-rating-cheat-sheet')).toHaveLength(3);
    expect(element.querySelector('[rating="severity"]')).not.toBeNull();
    expect(element.querySelector('[rating="occurrence"]')).not.toBeNull();
    expect(element.querySelector('[rating="detection"]')).not.toBeNull();
    expect(element.querySelector('.back-link')?.textContent).toContain('Back');
  });

  it('returns to the previous page from the generic back button', () => {
    const backButton = fixture.nativeElement.querySelector('.back-link') as HTMLButtonElement;
    backButton.click();

    expect(navigationHistoryMock.navigateBack).toHaveBeenCalledWith('/fmea');
  });

  it.each([
    [100, 'low'],
    [101, 'moderate'],
    [300, 'moderate'],
    [301, 'critical'],
  ])('classifies RPN %i as %s', (rpn, expectedRisk) => {
    expect(fixture.componentInstance.riskLevelFor({ ...entry, sev: rpn, occ: 1, det: 1 })).toBe(expectedRisk);
  });

  it('keeps edits local until save and cancel restores the original values', () => {
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.edit-button')?.click();
    fixture.detectChanges();

    const failureMode = element.querySelector<HTMLInputElement>('[formControlName="failureMode"]');
    expect(failureMode).not.toBeNull();
    failureMode!.value = 'Unsaved failure mode';
    failureMode!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fmeaServiceMock.updateFmeaEntry).not.toHaveBeenCalled();

    [...element.querySelectorAll<HTMLButtonElement>('.entry-actions button')]
      .find(button => button.textContent?.includes('Cancel'))?.click();
    fixture.detectChanges();

    expect(element.querySelector('h1')?.textContent).toContain('Wheel breaks');
    expect(element.querySelector('[formControlName="failureMode"]')).toBeNull();
    expect(fmeaServiceMock.updateFmeaEntry).not.toHaveBeenCalled();
  });

  it('updates the RPN risk color while ratings are being edited', () => {
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.edit-button')?.click();
    fixture.detectChanges();

    for (const fieldName of ['sev', 'occ', 'det']) {
      const input = element.querySelector<HTMLInputElement>(`[formControlName="${fieldName}"]`)!;
      input.value = '1';
      input.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();

    expect(element.querySelector('.rpn strong')?.textContent).toBe('1');
    expect(element.querySelector('.rpn')?.classList).toContain('risk-low');
    expect(element.querySelector('.risk-label')?.textContent).toBe('low');
    expect(fmeaServiceMock.updateFmeaEntry).not.toHaveBeenCalled();
  });

  it('saves the edited FMEA fields through the service', async () => {
    const element = fixture.nativeElement as HTMLElement;
    fmeaServiceMock.updateFmeaEntry.mockReturnValue(of({ ...entry, failureMode: 'Updated wheel failure' }));
    element.querySelector<HTMLButtonElement>('.edit-button')?.click();
    fixture.detectChanges();

    const failureMode = element.querySelector<HTMLInputElement>('[formControlName="failureMode"]')!;
    failureMode.value = 'Updated wheel failure';
    failureMode.dispatchEvent(new Event('input'));
    element.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fmeaServiceMock.updateFmeaEntry).toHaveBeenCalledWith('entry-1', {
      subsystemId: 'subsystem-1',
      failureMode: 'Updated wheel failure',
      failureEffect: 'The robot may not drive as well.',
      sev: 7,
      potentialCauses: 'Collision with another robot.',
      occ: 5,
      currentProcessControls: 'Inspect the wheel periodically.',
      det: 9,
    });
    expect(element.querySelector('h1')?.textContent).toContain('Updated wheel failure');
    expect(element.querySelector('[formControlName="failureMode"]')).toBeNull();
    expect(element.querySelector('.edit-button')).not.toBeNull();
  });

  it('does not delete the entry when the dialog is cancelled', async () => {
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.edit-button')?.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.delete-button')?.click();
    await fixture.whenStable();

    expect(dialogMock.open).toHaveBeenCalled();
    expect(fmeaServiceMock.deleteFmeaEntry).not.toHaveBeenCalled();
  });

  it('deletes and returns to the FMEA list after dialog confirmation', async () => {
    dialogMock.open.mockReturnValue({ afterClosed: () => of(true) });
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.edit-button')?.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.delete-button')?.click();
    await fixture.whenStable();

    expect(fmeaServiceMock.deleteFmeaEntry).toHaveBeenCalledWith('entry-1');
    expect(routerMock.navigate).toHaveBeenCalledWith(['/fmea']);
  });
});

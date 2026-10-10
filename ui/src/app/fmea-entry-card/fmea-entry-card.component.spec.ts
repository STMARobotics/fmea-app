import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FmeaEntry } from '../services/fmea.service';
import { FmeaEntryCardComponent } from './fmea-entry-card.component';

describe('FmeaEntryCardComponent', () => {
  let fixture: ComponentFixture<FmeaEntryCardComponent>;
  const entry: FmeaEntry = {
    id: 'entry-1',
    team: { id: 'team-1', program: 'ftc', teamNumber: 123, teamName: 'Robotics' },
    subsystem: { id: 'subsystem-1', name: 'Drive train' },
    failureMode: 'Motor failure',
    failureEffect: 'Robot cannot move',
    sev: 8,
    potentialCauses: 'Overheating',
    occ: 3,
    currentProcessControls: 'Thermal sensor',
    det: 2,
    lastUpdatedAt: new Date('2026-01-01'),
    actionItems: [],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FmeaEntryCardComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(FmeaEntryCardComponent);
    fixture.componentRef.setInput('fmeaEntry', entry);
    fixture.detectChanges();
  });

  it('renders entry details and its risk priority number', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.subsystem')?.textContent).toContain('Drive train');
    expect(element.querySelector('h2')?.textContent).toContain('Motor failure');
    expect(element.querySelector('.failure-effect')?.textContent).toContain('Robot cannot move');
    expect(element.querySelector('.rpn strong')?.textContent).toBe('48');
    expect(element.querySelector('.rpn')?.getAttribute('aria-label')).toBe('Risk priority number 48');
    expect(element.querySelectorAll('.rating strong').length).toBe(3);
    expect(element.querySelector('.fmea-entry-link')?.getAttribute('href')).toBe('/fmea/entry-1');
  });

  it('computes the RPN from the current input', () => {
    expect(fixture.componentInstance.rpn()).toBe(48);
    fixture.componentRef.setInput('fmeaEntry', { ...entry, sev: 1, occ: 1, det: 1 });
    expect(fixture.componentInstance.rpn()).toBe(1);
  });

  it('shows compact counts for active action-item statuses only', () => {
    fixture.componentRef.setInput('fmeaEntry', {
      ...entry,
      actionItems: [
        {
          id: 'action-1',
          description: 'Add a spare',
          status: 'not_started',
          fmeaEntryId: entry.id,
          lastUpdatedAt: new Date('2026-01-01'),
        },
        {
          id: 'action-2',
          description: 'Test the fix',
          status: 'in_progress',
          fmeaEntryId: entry.id,
          lastUpdatedAt: new Date('2026-01-01'),
        },
        {
          id: 'action-3',
          description: 'Add assembly notes',
          status: 'assembly_note',
          fmeaEntryId: entry.id,
          lastUpdatedAt: new Date('2026-01-01'),
        },
        {
          id: 'action-4',
          description: 'Complete old task',
          status: 'complete',
          fmeaEntryId: entry.id,
          lastUpdatedAt: new Date('2026-01-01'),
        },
      ],
    });
    fixture.detectChanges();

    const statuses = fixture.nativeElement.querySelectorAll('.action-status') as NodeListOf<HTMLElement>;
    expect(fixture.nativeElement.querySelector('.action-status-label')?.textContent?.trim()).toBe('Action items');
    expect(Array.from(statuses).map(status => status.textContent?.trim())).toEqual([
      'Not started: 1',
      'In progress: 1',
      'Assembly notes: 1',
    ]);
    expect(statuses[0].getAttribute('aria-label')).toBe('1 not started action items');
    expect(statuses[1].getAttribute('aria-label')).toBe('1 in progress action items');
    expect(statuses[2].getAttribute('aria-label')).toBe('1 assembly notes');
  });

  it('omits action-item status summary when there are no active action items', () => {
    fixture.componentRef.setInput('fmeaEntry', {
      ...entry,
      actionItems: [{
        id: 'action-1',
        description: 'Complete old task',
        status: 'complete',
        fmeaEntryId: entry.id,
        lastUpdatedAt: new Date('2026-01-01'),
      }],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.action-statuses')).toBeNull();
  });

  it.each([
    [1, 'risk-low'],
    [100, 'risk-low'],
    [101, 'risk-moderate'],
    [300, 'risk-moderate'],
    [301, 'risk-critical'],
  ])('marks RPN %i as %s', (rpn, riskClass) => {
    fixture.componentRef.setInput('fmeaEntry', { ...entry, sev: rpn, occ: 1, det: 1 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.fmea-entry')?.classList).toContain(riskClass);
    expect(fixture.nativeElement.querySelector('.rpn')?.classList).toContain(riskClass);
  });
});
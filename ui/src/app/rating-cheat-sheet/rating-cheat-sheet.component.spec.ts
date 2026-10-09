import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RatingCheatSheetComponent } from './rating-cheat-sheet.component';

describe('RatingCheatSheetComponent', () => {
  let fixture: ComponentFixture<RatingCheatSheetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RatingCheatSheetComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RatingCheatSheetComponent);
    fixture.componentRef.setInput('rating', 'severity');
    fixture.detectChanges();
  });

  it('opens only the selected rating table when clicked', () => {
    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector<HTMLButtonElement>('.help-button')!;
    button.click();
    fixture.detectChanges();

    expect(element.querySelectorAll('table')).toHaveLength(1);
    expect(element.querySelectorAll('tbody tr')).toHaveLength(10);
    expect(element.querySelector('h2')?.textContent).toContain('Severity');
    expect(element.querySelector('.help-button')?.getAttribute('aria-expanded')).toBe('true');

    button.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('table')).toHaveLength(0);
  });

  it('opens on keyboard focus and closes when focus leaves the guide', () => {
    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector<HTMLButtonElement>('.help-button')!;
    button.focus();
    fixture.detectChanges();

    expect(element.querySelectorAll('table')).toHaveLength(1);

    button.blur();
    fixture.detectChanges();

    expect(element.querySelectorAll('table')).toHaveLength(0);
  });

  it.each([
    ['severity', 'Severity (S)', 'Meaning'],
    ['occurrence', 'Occurrence (O)', 'Chance'],
    ['detection', 'Detection (D)', 'Meaning'],
  ] as const)('shows the %s guide with its own table heading', (rating, title, columnHeading) => {
    fixture.componentRef.setInput('rating', rating);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.help-button')?.click();
    fixture.detectChanges();

    expect(element.querySelectorAll('table')).toHaveLength(1);
    expect(element.querySelector('h2')?.textContent).toContain(title);
    expect(element.querySelector('thead')?.textContent).toContain(columnHeading);
  });
});

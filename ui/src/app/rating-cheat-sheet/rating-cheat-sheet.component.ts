import { Component, Input } from '@angular/core';

type RatingKind = 'severity' | 'occurrence' | 'detection';

interface RatingRow {
  score: number;
  description: string;
}

@Component({
  selector: 'app-rating-cheat-sheet',
  styleUrl: './rating-cheat-sheet.component.scss',
  templateUrl: './rating-cheat-sheet.component.html',
})
export class RatingCheatSheetComponent {
  @Input() rating: RatingKind = 'severity';

  private readonly guides: Record<RatingKind, { title: string; caption: string; rows: RatingRow[] }> = {
    severity: {
      title: 'Severity (S)',
      caption: 'Worst credible consequence if the failure happens during the event',
      rows: [
        { score: 1, description: 'No noticeable effect on match performance.' },
        { score: 2, description: 'Minor inconvenience; the robot performs as planned.' },
        { score: 3, description: 'Brief disruption, with no meaningful loss of function.' },
        { score: 4, description: 'Small performance reduction; the robot completes its planned role.' },
        { score: 5, description: 'Clear performance loss, but the robot still contributes.' },
        { score: 6, description: "An important function is lost, limiting the robot's contribution." },
        { score: 7, description: 'The robot cannot perform its planned role for a significant part of a match.' },
        { score: 8, description: 'The robot is disabled or provides little contribution for most of a match.' },
        { score: 9, description: 'The match outcome is likely affected, or substantial damage requires lengthy repair.' },
        { score: 10, description: 'A serious safety hazard occurs, or damage makes the robot unusable for the rest of the event.' },
      ],
    },
    occurrence: {
      title: 'Occurrence (O)',
      caption: 'Approximate chance the failure happens in any one match',
      rows: [
        { score: 1, description: 'Less than 1% — exceptionally unlikely.' },
        { score: 2, description: '1% to less than 5% — very rare.' },
        { score: 3, description: '5% to less than 10% — rare.' },
        { score: 4, description: '10% to less than 20% — unlikely.' },
        { score: 5, description: '20% to less than 30% — occasional.' },
        { score: 6, description: '30% to less than 45% — plausible.' },
        { score: 7, description: '45% to less than 60% — fairly likely.' },
        { score: 8, description: '60% to less than 75% — likely.' },
        { score: 9, description: '75% to 90% — very likely.' },
        { score: 10, description: 'More than 90% — almost certain.' },
      ],
    },
    detection: {
      title: 'Detection (D)',
      caption: "Chance the team's current checks miss the issue before it affects a match",
      rows: [
        { score: 1, description: 'Automatic safeguards almost always detect or prevent it before match impact.' },
        { score: 2, description: 'A reliable built-in check catches it in nearly every case.' },
        { score: 3, description: 'Routine pre-match checks are very likely to catch it.' },
        { score: 4, description: 'Routine checks usually catch it, though misses are possible.' },
        { score: 5, description: 'A deliberate, targeted check is more likely than not to catch it.' },
        { score: 6, description: 'Checks catch it inconsistently; it may reach a match unnoticed.' },
        { score: 7, description: 'Routine checks usually miss it; a specific test is needed.' },
        { score: 8, description: 'It is unlikely to be caught without specialized testing or diagnostics.' },
        { score: 9, description: 'Existing checks almost never catch it before it affects a match.' },
        { score: 10, description: 'No known practical check catches it before it affects a match.' },
      ],
    },
  };

  isPinnedOpen = false;
  isHovered = false;
  isFocused = false;
  panelLeft = 12;
  panelTop = 12;

  get isOpen(): boolean {
    return this.isPinnedOpen || this.isHovered || this.isFocused;
  }

  get guide(): { title: string; caption: string; rows: RatingRow[] } {
    return this.guides[this.rating];
  }

  onMouseEnter(event: MouseEvent): void {
    this.isHovered = true;
    this.positionPanel(event.currentTarget);
  }

  onFocusIn(event: FocusEvent): void {
    this.isFocused = true;
    this.positionPanel(event.currentTarget);
  }

  toggle(button: HTMLButtonElement): void {
    this.isPinnedOpen = !this.isPinnedOpen;
    if (this.isPinnedOpen) {
      this.positionPanel(button);
    } else {
      button.blur();
    }
  }

  private positionPanel(target: EventTarget | null): void {
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const anchor = target.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const panelWidth = Math.min(440, viewportWidth - 36);
    const panelMaxHeight = Math.min(viewportHeight * 0.65, 600);

    this.panelLeft = Math.max(18, Math.min(anchor.left, viewportWidth - panelWidth - 18));
    this.panelTop = Math.max(
      12,
      Math.min(anchor.bottom + 8, viewportHeight - panelMaxHeight - 12),
    );
  }
}

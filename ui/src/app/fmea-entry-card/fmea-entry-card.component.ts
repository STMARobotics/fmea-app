import { Component, computed, input } from '@angular/core';
import { MatCardModule } from "@angular/material/card";
import { RouterLink } from '@angular/router';
import { FmeaEntry } from '../services/fmea.service';

@Component({
  imports: [MatCardModule, RouterLink],
  selector: 'fmea-entry-card',
  styleUrl: './fmea-entry-card.component.scss',
  templateUrl: './fmea-entry-card.component.html',
})
export class FmeaEntryCardComponent {
  readonly fmeaEntry = input.required<FmeaEntry>();

  readonly actionItemCounts = computed(() => {
    const actionItems = this.fmeaEntry().actionItems;
    return {
      notStarted: actionItems.filter(actionItem => actionItem.status === 'not_started').length,
      inProgress: actionItems.filter(actionItem => actionItem.status === 'in_progress').length,
      assemblyNotes: actionItems.filter(actionItem => actionItem.status === 'assembly_note').length,
    };
  });

  readonly rpn = computed(() => {
    const entry = this.fmeaEntry();
    return entry.sev * entry.occ * entry.det;
  });

  readonly riskLevel = computed(() => {
    const rpn = this.rpn();
    if (rpn < 1) {
      return null;
    }
    if (rpn <= 100) {
      return 'low';
    }
    if (rpn <= 300) {
      return 'moderate';
    }
    return 'critical';
  });
}

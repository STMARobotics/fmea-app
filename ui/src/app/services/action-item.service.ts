import { inject, Injectable } from "@angular/core";
import { Observable, tap } from "rxjs";
import { fromFetch } from "rxjs/fetch";
import { FmeaService } from "./fmea.service";

export type ActionItemStatus = 'not_started' | 'in_progress' | 'assembly_note' | 'complete';

export type ActionItem = {
  id: string,
  description: string,
  status: ActionItemStatus,
  fmeaEntryId: string,
  lastUpdatedAt: Date
};

export type PartialActionItem = Pick<ActionItem, 'description' | 'status' | 'fmeaEntryId'>;

@Injectable({
  providedIn: 'root'
})
export class ActionItemService {
  private readonly fmeaService = inject(FmeaService);

  updateActionItem(actionItemId: string, partialActionItem: PartialActionItem): Observable<ActionItem> {
    return fromFetch<ActionItem>(`http://localhost:3000/api/action-item/${actionItemId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(partialActionItem),
      selector: response => {
        if (!response.ok) {
          throw new Error(`Unable to update action item (${response.status}).`);
        }
        return response.json();
      },
    }).pipe(tap(() => this.fmeaService.notifyFmeaEntriesChanged()));
  }
}

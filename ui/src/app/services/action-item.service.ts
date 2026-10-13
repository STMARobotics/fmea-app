import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from "@angular/core";
import { Observable, tap } from "rxjs";
import { FmeaService } from "./fmea.service";
import { withApiError } from './api-error';

export type ActionItemStatus = 'not_started' | 'in_progress' | 'assembly_note' | 'complete';

export type ActionItem = {
  id: string,
  description: string,
  status: ActionItemStatus,
  fmeaEntryId: string,
  lastUpdatedAt: Date
};

export type PartialActionItem = Pick<ActionItem, 'description' | 'status' | 'fmeaEntryId'>;

export type CreateActionItemRequest = Pick<ActionItem, 'description'>;

@Injectable({
  providedIn: 'root'
})
export class ActionItemService {
  private readonly http = inject(HttpClient);
  private readonly fmeaService = inject(FmeaService);

  createActionItem(fmeaEntryId: string, request: CreateActionItemRequest): Observable<ActionItem> {
    return this.http.post<ActionItem>(`/api/fmea/${encodeURIComponent(fmeaEntryId)}/action-items`, request).pipe(
      withApiError('Unable to create action item'),
      tap(() => this.fmeaService.notifyFmeaEntriesChanged()),
    );
  }

  updateActionItem(actionItemId: string, partialActionItem: PartialActionItem): Observable<ActionItem> {
    return this.http.patch<ActionItem>(`/api/action-item/${encodeURIComponent(actionItemId)}`, partialActionItem).pipe(
      withApiError('Unable to update action item'),
      tap(() => this.fmeaService.notifyFmeaEntriesChanged()),
    );
  }
}

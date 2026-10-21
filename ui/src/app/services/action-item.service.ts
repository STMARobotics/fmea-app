import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from "@angular/core";
import { map, Observable, tap } from "rxjs";
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

export type PartialActionItem = Pick<ActionItem, 'description' | 'status' | 'fmeaEntryId'> & {
  expectedDescription?: string,
};

export type CreateActionItemRequest = Pick<ActionItem, 'description'> & {
  status: Extract<ActionItemStatus, 'not_started' | 'assembly_note'>,
};

export type EditableActionItem = {
  id: string | null,
  description: string,
  status: ActionItemStatus,
};

export type ReplaceActionItemsResponse = {
  actionItems: ActionItem[],
  lastUpdatedAt: Date,
};

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

  replaceActionItems(
    fmeaEntryId: string,
    expectedLastUpdatedAt: string,
    actionItems: EditableActionItem[],
  ): Observable<ReplaceActionItemsResponse> {
    return this.http.put<ReplaceActionItemsResponse>(
      `/api/fmea/${encodeURIComponent(fmeaEntryId)}/action-items`,
      { expectedLastUpdatedAt, actionItems },
    ).pipe(
      withApiError('Unable to save action items'),
      tap(() => this.fmeaService.notifyFmeaEntriesChanged()),
    );
  }

  updateActionItem(actionItemId: string, partialActionItem: PartialActionItem): Observable<ActionItem> {
    return this.http.patch<ActionItem>(`/api/action-item/${encodeURIComponent(actionItemId)}`, partialActionItem).pipe(
      withApiError('Unable to update action item'),
      tap(() => this.fmeaService.notifyFmeaEntriesChanged()),
    );
  }

  deleteActionItem(actionItemId: string, expectedDescription: string): Observable<void> {
    return this.http.delete<void>(`/api/action-item/${encodeURIComponent(actionItemId)}`, {
      body: { expectedDescription },
    }).pipe(
      map(() => undefined),
      withApiError('Unable to delete action item'),
      tap(() => this.fmeaService.notifyFmeaEntriesChanged()),
    );
  }
}

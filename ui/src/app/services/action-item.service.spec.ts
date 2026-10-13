import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { ActionItem, ActionItemService, PartialActionItem } from './action-item.service';
import { FmeaService } from './fmea.service';

describe('ActionItemService', () => {
  let service: ActionItemService;
  let fmeaService: FmeaService;
  let http: HttpTestingController;
  const actionItem: ActionItem = {
    id: 'action-1',
    description: 'Add temperature monitoring',
    status: 'in_progress',
    fmeaEntryId: 'entry-1',
    lastUpdatedAt: new Date('2026-02-01'),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ActionItemService);
    fmeaService = TestBed.inject(FmeaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('patches a partial action item and returns the updated action item', async () => {
    const update: PartialActionItem = {
      description: actionItem.description,
      status: 'complete',
      fmeaEntryId: actionItem.fmeaEntryId,
    };
    const result = firstValueFrom(service.updateActionItem('action-1', update));
    const request = http.expectOne('/api/action-item/action-1');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(update);
    request.flush(actionItem);
    await expect(result).resolves.toEqual(actionItem);
  });

  it('posts a new action item and returns the created action item', async () => {
    const result = firstValueFrom(service.createActionItem('entry-1', {
      description: actionItem.description,
    }));
    const request = http.expectOne('/api/fmea/entry-1/action-items');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ description: actionItem.description });
    request.flush(actionItem);
    await expect(result).resolves.toEqual(actionItem);
  });

  it('reports an HTTP error when an action item cannot be created', async () => {
    const result = firstValueFrom(service.createActionItem('entry-1', {
      description: actionItem.description,
    }));
    http.expectOne('/api/fmea/entry-1/action-items').flush({}, { status: 503, statusText: 'Unavailable' });
    await expect(result).rejects.toThrow('Unable to create action item (503).');
  });

  it('reports an HTTP error when an action item cannot be updated', async () => {
    const result = firstValueFrom(service.updateActionItem('action-1', {
      description: actionItem.description,
      status: 'complete',
      fmeaEntryId: actionItem.fmeaEntryId,
    }));
    http.expectOne('/api/action-item/action-1').flush({}, { status: 503, statusText: 'Unavailable' });
    await expect(result).rejects.toThrow('Unable to update action item (503).');
  });

  it('notifies subscribers after a successful update', async () => {
    const changes: void[] = [];
    const subscription = fmeaService.fmeaEntriesChanged$.subscribe(() => changes.push(undefined));
    const result = firstValueFrom(service.updateActionItem('action-1', {
      description: actionItem.description,
      status: 'complete',
      fmeaEntryId: actionItem.fmeaEntryId,
    }));
    http.expectOne('/api/action-item/action-1').flush(actionItem);
    await result;
    subscription.unsubscribe();

    expect(changes).toHaveLength(1);
  });
});
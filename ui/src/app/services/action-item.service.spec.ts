import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ActionItem, ActionItemService, PartialActionItem } from './action-item.service';
import { FmeaService } from './fmea.service';

describe('ActionItemService', () => {
  let service: ActionItemService;
  let fmeaService: FmeaService;
  const actionItem: ActionItem = {
    id: 'action-1',
    description: 'Add temperature monitoring',
    status: 'in_progress',
    fmeaEntryId: 'entry-1',
    lastUpdatedAt: new Date('2026-02-01'),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ActionItemService);
    fmeaService = TestBed.inject(FmeaService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts a partial action item and returns the updated action item', async () => {
    const update: PartialActionItem = {
      description: actionItem.description,
      status: 'complete',
      fmeaEntryId: actionItem.fmeaEntryId,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(actionItem),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(firstValueFrom(service.updateActionItem('action-1', update))).resolves.toEqual(actionItem);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/action-item/action-1',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('reports an HTTP error when an action item cannot be updated', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    await expect(firstValueFrom(service.updateActionItem('action-1', {
      description: actionItem.description,
      status: 'complete',
      fmeaEntryId: actionItem.fmeaEntryId,
    })))
      .rejects.toThrow('Unable to update action item (503).');
  });

  it('notifies subscribers after a successful update', async () => {
    const changes: void[] = [];
    const subscription = fmeaService.fmeaEntriesChanged$.subscribe(() => changes.push(undefined));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(actionItem),
    }));

    await firstValueFrom(service.updateActionItem('action-1', {
      description: actionItem.description,
      status: 'complete',
      fmeaEntryId: actionItem.fmeaEntryId,
    }));
    subscription.unsubscribe();

    expect(changes).toHaveLength(1);
  });
});
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseActivity, activityConfig } from './activity-contract.js';
import { submissionOutbox } from './fmea-activity.js';
test('accepts shared fixtures and preserves submitted business date when deleting later', () => {
  const fixtures = JSON.parse(
    readFileSync(resolve(__dirname, '../../../contracts/fixtures/activity-v1.json'), 'utf8'),
  );
  for (const event of fixtures) assert.deepEqual(parseActivity(event), event);
  const event = submissionOutbox(
    'example-team',
    'example-fmea',
    'synthetic-subject',
    '2026-11-04T18:00:00.000Z',
    '2026-11-04T18:00:00.000Z',
    1,
    true,
  );
  assert.equal(event.eventId?.S, fixtures[3].eventId);
  const revoked = submissionOutbox(
    'example-team',
    'example-fmea',
    'synthetic-subject',
    '2026-11-04T01:00:00.000Z',
    '2026-11-05T18:00:00.000Z',
    2,
    false,
  );
  assert.equal(revoked.effectiveDate?.S, '2026-11-03');
  assert.equal(revoked.fmeaSubmitted?.N, '0');
  assert.equal(revoked.entityVersion?.N, '2');
  assert.equal(activityConfig({}), undefined);
  assert.throws(() => activityConfig({ INTEGRATION_ENABLED: 'true' }));
});

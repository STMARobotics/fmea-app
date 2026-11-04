import type { AttributeValue } from '@aws-sdk/client-dynamodb';
import { makeActivity, outboxItem } from './activity-contract.js';

export function submissionOutbox(
  orgId: string,
  id: string,
  googleSub: string,
  createdAt: string,
  occurredAt: string,
  version: 1 | 2,
  valid: boolean,
): Record<string, AttributeValue> {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date(createdAt))
      .map((p) => [p.type, p.value]),
  );
  const event = makeActivity({
    type: 'fmea.submission.changed.v1',
    source: 'fmea',
    orgId,
    entityId: id,
    entityVersion: version,
    subject: { namespace: 'fmea.google', id: googleSub },
    occurredAt,
    effectiveDate: parts.year + '-' + parts.month + '-' + parts.day,
    metrics: { fmeaSubmitted: valid ? 1 : 0 },
  });
  return Object.fromEntries(
    Object.entries(outboxItem(event)).map(([key, value]) => [
      key,
      typeof value === 'number' ? { N: String(value) } : { S: value },
    ]),
  );
}

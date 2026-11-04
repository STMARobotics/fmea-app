import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { dynamoDB, type HttpEvent } from './fmea-utils.js';
import { handler as create } from './create-fmea-entry.handler.js';
import { handler as remove } from './delete-fmea-entry.handler.js';

const payload = {
  teamId: 'team-1',
  seasonId: 'season-1',
  subsystemId: 'sub-1',
  failureMode: 'Bearing jams',
  failureEffect: 'Arm stops',
  sev: 5,
  potentialCauses: 'Wear',
  occ: 3,
  currentProcessControls: 'Inspection',
  det: 4,
};
const request = (
  body = payload,
  subject = 'verified-sub',
  id = 'submission-key-0001',
): HttpEvent => ({
  body: JSON.stringify(body),
  headers: { 'idempotency-key': id },
  requestContext: { authorizer: { lambda: { googleSub: subject } } },
});

function database(t: TestContext, enabled = true) {
  const previous = {
    TABLE_NAME: process.env.TABLE_NAME,
    INTEGRATION_ENABLED: process.env.INTEGRATION_ENABLED,
    INTEGRATION_ORG_ID: process.env.INTEGRATION_ORG_ID,
  };
  process.env.TABLE_NAME = 'synthetic-fmea';
  process.env.INTEGRATION_ENABLED = enabled ? 'true' : 'false';
  process.env.INTEGRATION_ORG_ID = 'example-team';
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const rows = new Map<string, any>();
  const key = (item: any) => item.pk.S + '|' + item.sk.S;
  const subsystem = {
    pk: { S: 'TEAM#team-1' },
    sk: { S: 'SUBSYSTEM#sub-1' },
    seasonId: { S: 'season-1' },
    name: { S: 'Arm' },
  };
  const team = {
    pk: { S: 'TEAM#team-1' },
    sk: { S: 'METADATA' },
    program: { S: 'frc' },
    teamNumber: { N: '7028' },
    name: { S: 'Example' },
  };
  rows.set(key(subsystem), subsystem);
  rows.set(key(team), team);
  let transactions = 0,
    failNext = false;
  const cancelled = () =>
    Object.assign(new Error('conditional failure'), { name: 'TransactionCanceledException' });
  t.mock.method(dynamoDB, 'send', async (command: any) => {
    const input = command.input;
    switch (command.constructor.name) {
      case 'GetItemCommand':
        return { Item: structuredClone(rows.get(key(input.Key))) };
      case 'QueryCommand':
        return {
          Items: [...rows.values()].filter(
            (r) => r.gsi2pk?.S === input.ExpressionAttributeValues[':partition'].S,
          ),
        };
      case 'TransactWriteItemsCommand': {
        transactions++;
        if (failNext) {
          failNext = false;
          throw cancelled();
        }
        for (const op of input.TransactItems) {
          if (op.Put && rows.has(key(op.Put.Item))) throw cancelled();
          if (op.Delete) {
            const current = rows.get(key(op.Delete.Key));
            if (
              !current ||
              current.lastUpdated.S !== op.Delete.ExpressionAttributeValues[':expected'].S
            )
              throw cancelled();
          }
          if (
            op.ConditionCheck &&
            rows.get(key(op.ConditionCheck.Key))?.seasonId?.S !==
              op.ConditionCheck.ExpressionAttributeValues[':season'].S
          )
            throw cancelled();
        }
        for (const op of input.TransactItems) {
          if (op.Put) rows.set(key(op.Put.Item), structuredClone(op.Put.Item));
          if (op.Delete) rows.delete(key(op.Delete.Key));
        }
        return {};
      }
      default:
        throw new Error('Unexpected database command ' + command.constructor.name);
    }
  });
  return {
    rows,
    entries: () => [...rows.values()].filter((r) => r.sk?.S.startsWith('FMEA#')),
    events: () => [...rows.values()].filter((r) => r.recordType?.S === 'ACTIVITY_OUTBOX_V1'),
    transactions: () => transactions,
    fail: () => {
      failNext = true;
    },
  };
}

test('submission replay preserves one attributed entry and one event, and rejects changed content', async (t) => {
  const db = database(t);
  const first = await create(request({ ...payload, createdBySubject: 'forged' } as any));
  assert.equal(first.statusCode, 201);
  const again = await create(request());
  assert.equal(again.statusCode, 200);
  assert.equal(JSON.parse(again.body).id, JSON.parse(first.body).id);
  assert.equal(db.entries().length, 1);
  assert.equal(db.events().length, 1);
  assert.equal(db.transactions(), 1);
  assert.equal(db.entries()[0].createdBySubject.S, 'verified-sub');
  assert.equal(db.events()[0].subjectId.S, 'verified-sub');
  assert.equal(
    (await create(request({ ...payload, failureMode: 'Different content' }))).statusCode,
    409,
  );
  assert.equal(db.entries().length, 1);
  assert.equal(JSON.stringify(db.events()).includes('Bearing jams'), false);
  assert.equal(first.body.includes('verified-sub'), false);
});

test('a failed source transaction leaves no form, operation claim, or event', async (t) => {
  const db = database(t);
  db.fail();
  assert.equal((await create(request())).statusCode, 409);
  assert.equal(db.entries().length, 0);
  assert.equal(db.events().length, 0);
  assert.equal([...db.rows.values()].filter((r) => r.pk.S.startsWith('FMEASUBMISSION#')).length, 0);
  assert.equal((await create(request())).statusCode, 201);
});

test('deletion emits a zero snapshot atomically and an old submission key cannot recreate the form', async (t) => {
  const db = database(t);
  const first = await create(request());
  const id = JSON.parse(first.body).id;
  // Stopping new capture cannot suppress reversals of already captured entries.
  process.env.INTEGRATION_ENABLED = 'false';
  assert.equal((await remove({ pathParameters: { fmeaId: id } })).statusCode, 204);
  assert.deepEqual(
    db.events().map((r) => [r.entityVersion.N, r.fmeaSubmitted.N]),
    [
      ['1', '1'],
      ['2', '0'],
    ],
  );
  assert.equal(db.entries().length, 0);
  assert.equal((await create(request())).statusCode, 410);
});

test('enabled capture requires a durable key and verified identity; the compatibility path stays event-free', async (t) => {
  const db = database(t);
  assert.equal(
    (
      await create({
        body: JSON.stringify(payload),
        headers: { 'idempotency-key': 'submission-key-0001' },
      })
    ).statusCode,
    401,
  );
  assert.equal((await create({ ...request(), headers: {} })).statusCode, 400);
  process.env.INTEGRATION_ENABLED = 'false';
  assert.equal((await create({ ...request(), headers: {} })).statusCode, 201);
  assert.equal(db.events().length, 0);
  assert.equal(db.entries()[0].createdBySubject.S, 'verified-sub');
});

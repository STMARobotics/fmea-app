import {
  GetItemCommand,
  TransactWriteItemsCommand,
  type AttributeValue,
  type TransactWriteItem,
} from '@aws-sdk/client-dynamodb';
import { activityConfig, digest } from '../integration/activity-contract.js';
import { submissionOutbox } from '../integration/fmea-activity.js';
import {
  createFmeaId,
  dynamoDB,
  fmeaItem,
  formatFmeaEntry,
  getTableName,
  isCreateFmeaRequest,
  jsonResponse,
  parseRequestBody,
  readFmea,
  readSubsystemMetadata,
  type HttpEvent,
} from './fmea-utils.js';

export const handler = async (event: HttpEvent) => {
  const request = parseRequestBody(event.body);
  if (!request || !isCreateFmeaRequest(request))
    return jsonResponse(400, {
      message:
        'Provide team, season, subsystem, failure details, and integer ratings from 1 to 10.',
    });
  const auth = event.requestContext?.authorizer;
  const googleSub = auth?.googleSub ?? auth?.lambda?.googleSub ?? auth?.principalId;
  if (!googleSub || googleSub.length > 256)
    return jsonResponse(401, { message: 'Verified submission identity is required.' });
  const requestId = event.headers?.['idempotency-key'] ?? event.headers?.['Idempotency-Key'];
  if (requestId !== undefined && !/^[a-zA-Z0-9_-]{16,128}$/.test(requestId))
    return jsonResponse(400, { message: 'Provide a valid Idempotency-Key.' });
  try {
    const config = activityConfig();
    if (config && !requestId)
      return jsonResponse(400, {
        message: 'Idempotency-Key is required for integrated submissions.',
      });
    const table = getTableName();
    // Hash the normalized business payload, not JSON property order or arbitrary extra fields.
    const payloadHash = digest([
      request.teamId,
      request.seasonId,
      request.subsystemId,
      request.failureMode.trim(),
      request.failureEffect.trim(),
      request.sev,
      request.potentialCauses,
      request.occ,
      request.currentProcessControls,
      request.det,
    ]);
    const operationKey = requestId
      ? { pk: { S: 'FMEASUBMISSION#' + digest([googleSub, requestId]) }, sk: { S: 'OP' } }
      : undefined;
    const replay = async () => {
      if (!operationKey) return undefined;
      const operation = (
        await dynamoDB.send(
          new GetItemCommand({ TableName: table, Key: operationKey, ConsistentRead: true }),
        )
      ).Item;
      if (!operation) return undefined;
      if (operation.payloadHash?.S !== payloadHash)
        return jsonResponse(409, {
          message: 'This submission key was already used for different content.',
        });
      const existing = (
        await dynamoDB.send(
          new GetItemCommand({
            TableName: table,
            Key: { pk: operation.entryPk!, sk: operation.entrySk! },
            ConsistentRead: true,
          }),
        )
      ).Item;
      if (!existing)
        return jsonResponse(410, {
          message: 'The original submission was removed. Start a new form to submit again.',
        });
      return jsonResponse(200, await formatFmeaEntry(readFmea(existing)));
    };
    const saved = await replay();
    if (saved) return saved;
    const subsystemResult = await dynamoDB.send(
      new GetItemCommand({
        TableName: table,
        Key: { pk: { S: 'TEAM#' + request.teamId }, sk: { S: 'SUBSYSTEM#' + request.subsystemId } },
        ConsistentRead: true,
      }),
    );
    if (!subsystemResult.Item) return jsonResponse(404, { message: 'Subsystem not found.' });
    const subsystem = readSubsystemMetadata(subsystemResult.Item);
    if (subsystem.seasonId !== request.seasonId)
      return jsonResponse(400, {
        message: 'The subsystem does not belong to the selected season.',
      });
    const now = new Date().toISOString(),
      id = createFmeaId();
    const item = fmeaItem(id, request, subsystem.teamId, subsystem.seasonId, now);
    item.createdBySubject = { S: googleSub };
    item.createdAt = { S: now };
    item.activityVersion = { N: '1' };
    const writes: TransactWriteItem[] = [
      { Put: { TableName: table, Item: item, ConditionExpression: 'attribute_not_exists(pk)' } },
    ];
    if (operationKey)
      writes.push({
        Put: {
          TableName: table,
          Item: {
            ...operationKey,
            payloadHash: { S: payloadHash },
            entryPk: item.pk!,
            entrySk: item.sk!,
          },
          ConditionExpression: 'attribute_not_exists(pk)',
        },
      });
    if (config) {
      item.activityOrgId = { S: config.orgId };
      writes.push({
        Put: {
          TableName: table,
          Item: submissionOutbox(config.orgId, id, googleSub, now, now, 1, true),
          ConditionExpression: 'attribute_not_exists(pk)',
        },
      });
    }
    // Do not commit a form against a subsystem that changed/disappeared after validation.
    writes.push({
      ConditionCheck: {
        TableName: table,
        Key: { pk: { S: 'TEAM#' + request.teamId }, sk: { S: 'SUBSYSTEM#' + request.subsystemId } },
        ConditionExpression: 'seasonId = :season',
        ExpressionAttributeValues: { ':season': { S: request.seasonId } },
      },
    });
    try {
      await dynamoDB.send(new TransactWriteItemsCommand({ TransactItems: writes }));
    } catch (error) {
      if ((error as { name?: string }).name === 'TransactionCanceledException') {
        const repeated = await replay();
        if (repeated) return repeated;
        return jsonResponse(409, {
          message: 'Submission changed concurrently. Retry the same submission.',
        });
      }
      throw error;
    }
    return jsonResponse(201, await formatFmeaEntry(readFmea(item)));
  } catch {
    console.error('Failed to commit FMEA submission.');
    return jsonResponse(500, { message: 'Unable to create FMEA item.' });
  }
};

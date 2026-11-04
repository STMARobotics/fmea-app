import { TransactWriteItemsCommand, type TransactWriteItem } from '@aws-sdk/client-dynamodb';
import { submissionOutbox } from '../integration/fmea-activity.js';
import {
  dynamoDB,
  emptyResponse,
  findFmeaById,
  getFmeaKey,
  getPathParameter,
  getTableName,
  jsonResponse,
  type HttpEvent,
} from './fmea-utils.js';

export const handler = async (event: HttpEvent) => {
  const id = getPathParameter(event, 'fmeaId');
  if (!id) return jsonResponse(400, { message: 'An FMEA ID is required.' });
  try {
    const existing = await findFmeaById(id);
    if (!existing) return jsonResponse(404, { message: 'FMEA item not found.' });
    const table = getTableName();
    const writes: TransactWriteItem[] = [
      {
        Delete: {
          TableName: table,
          Key: getFmeaKey(existing),
          ConditionExpression: 'attribute_exists(pk) AND lastUpdated = :expected',
          ExpressionAttributeValues: { ':expected': existing.lastUpdated! },
        },
      },
    ];
    // Already-captured entries still emit their reversal if new capture is later disabled.
    if (existing.activityOrgId?.S) {
      const author = existing.createdBySubject?.S,
        createdAt = existing.createdAt?.S;
      if (!author || !createdAt || existing.activityVersion?.N !== '1')
        throw new Error('Incomplete activity attribution.');
      writes.push({
        Put: {
          TableName: table,
          Item: submissionOutbox(
            existing.activityOrgId.S,
            id,
            author,
            createdAt,
            new Date().toISOString(),
            2,
            false,
          ),
          ConditionExpression: 'attribute_not_exists(pk)',
        },
      });
    }
    await dynamoDB.send(new TransactWriteItemsCommand({ TransactItems: writes }));
    return emptyResponse(204);
  } catch (error) {
    if ((error as { name?: string }).name === 'TransactionCanceledException')
      return jsonResponse(409, {
        message: 'This entry changed concurrently. Refresh before removing it.',
      });
    console.error('Failed to remove FMEA submission.');
    return jsonResponse(500, { message: 'Unable to delete FMEA item.' });
  }
};

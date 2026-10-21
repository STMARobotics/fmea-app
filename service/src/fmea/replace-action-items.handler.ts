import {
  ConditionalCheckFailedException,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  dynamoDB,
  findFmeaById,
  getFmeaKey,
  getPathParameter,
  getTableName,
  isActionItemStatus,
  jsonResponse,
  parseRequestBody,
  type HttpEvent,
} from './fmea-utils';

type ActionItemUpdate = {
  id: string | null;
  description: string;
  status: string;
};

class InvalidActionItemListError extends Error {}

export const handler = async (event: HttpEvent) => {
  const fmeaId = getPathParameter(event, 'fmeaId');
  const request = parseRequestBody(event.body);
  const actionItems: ActionItemUpdate[] | undefined = Array.isArray(request?.actionItems)
    ? request.actionItems as ActionItemUpdate[]
    : undefined;

  if (
    !fmeaId ||
    typeof request?.expectedLastUpdatedAt !== 'string' ||
    !request.expectedLastUpdatedAt ||
    !actionItems ||
    actionItems.some(item =>
      !item ||
      (item.id !== null && typeof item.id !== 'string') ||
      typeof item.description !== 'string' ||
      item.description.trim().length === 0 ||
      !isActionItemStatus(item.status),
    )
  ) {
    return jsonResponse(400, { message: 'A valid expected update time and action item list are required.' });
  }

  try {
    const existing = await findFmeaById(fmeaId);
    if (!existing) {
      return jsonResponse(404, { message: 'FMEA item not found.' });
    }

    const currentItems = existing.actionItems?.L;
    if (!currentItems) {
      throw new Error('DynamoDB returned an FMEA item without action items.');
    }

    const seenIds = new Set<string>();
    const now = new Date().toISOString();
    const items = actionItems.map((item, index) => {
      let lastUpdatedAt = now;
      if (item.id !== null) {
        const prefix = `${fmeaId}:`;
        const originalIndex = item.id.startsWith(prefix) ? Number(item.id.slice(prefix.length)) : NaN;
        if (
          !Number.isSafeInteger(originalIndex) ||
          originalIndex < 0 ||
          originalIndex >= currentItems.length ||
          seenIds.has(item.id)
        ) {
          throw new InvalidActionItemListError('The action item list contains an invalid or duplicate ID.');
        }
        seenIds.add(item.id);
        const existingItem = currentItems[originalIndex]?.M;
        if (!existingItem?.description?.S || !existingItem.status?.S) {
          throw new Error('DynamoDB returned a malformed FMEA action item.');
        }
        if (
          existingItem.description.S === item.description.trim() &&
          existingItem.status.S === item.status &&
          existingItem.lastUpdated?.S
        ) {
          lastUpdatedAt = existingItem.lastUpdated.S;
        }
      }
      return {
        id: `${fmeaId}:${index}`,
        description: item.description.trim(),
        status: item.status,
        fmeaEntryId: fmeaId,
        lastUpdatedAt,
      };
    });

    await dynamoDB.send(new UpdateItemCommand({
      TableName: getTableName(),
      Key: getFmeaKey(existing),
      UpdateExpression: 'SET #actionItems = :actionItems, #lastUpdated = :lastUpdated',
      ConditionExpression: '#lastUpdated = :expectedLastUpdatedAt',
      ExpressionAttributeNames: {
        '#actionItems': 'actionItems',
        '#lastUpdated': 'lastUpdated',
      },
      ExpressionAttributeValues: {
        ':actionItems': {
          L: items.map(item => ({
            M: {
              description: { S: item.description },
              status: { S: item.status },
              lastUpdated: { S: item.lastUpdatedAt },
            },
          })),
        },
        ':lastUpdated': { S: now },
        ':expectedLastUpdatedAt': { S: request.expectedLastUpdatedAt },
      },
    }));

    return jsonResponse(200, { actionItems: items, lastUpdatedAt: now });
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return jsonResponse(409, { message: 'This FMEA item changed while action items were being edited. Reload and try again.' });
    }
    if (error instanceof InvalidActionItemListError) {
      return jsonResponse(400, { message: error.message });
    }
    console.error('Failed to replace FMEA action items in DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to save action items.' });
  }
};

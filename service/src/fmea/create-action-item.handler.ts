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

export const handler = async (event: HttpEvent) => {
  const fmeaEntryId = getPathParameter(event, 'fmeaId');
  const request = parseRequestBody(event.body);
  const status = request?.status ?? 'not_started';
  if (
    !fmeaEntryId ||
    !request ||
    typeof request.description !== 'string' ||
    request.description.trim().length === 0 ||
    (status !== 'not_started' && status !== 'assembly_note') ||
    !isActionItemStatus(status)
  ) {
    return jsonResponse(400, { message: 'A non-empty description and valid creation status are required.' });
  }

  try {
    const existing = await findFmeaById(fmeaEntryId);
    if (!existing) {
      return jsonResponse(404, { message: 'FMEA item not found.' });
    }

    const now = new Date().toISOString();
    const result = await dynamoDB.send(new UpdateItemCommand({
      TableName: getTableName(),
      Key: getFmeaKey(existing),
      UpdateExpression: 'SET #actionItems = list_append(if_not_exists(#actionItems, :empty), :newActionItem), #lastUpdated = :lastUpdated',
      ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)',
      ExpressionAttributeNames: {
        '#actionItems': 'actionItems',
        '#lastUpdated': 'lastUpdated',
      },
      ExpressionAttributeValues: {
        ':empty': { L: [] },
        ':newActionItem': {
          L: [{
            M: {
              description: { S: request.description.trim() },
              status: { S: status },
              lastUpdated: { S: now },
            },
          }],
        },
        ':lastUpdated': { S: now },
      },
      ReturnValues: 'ALL_NEW',
    }));

    const actionItems = result.Attributes?.actionItems?.L;
    if (!actionItems?.length) {
      throw new Error('DynamoDB did not return the created action item.');
    }

    return jsonResponse(201, {
      id: `${fmeaEntryId}:${actionItems.length - 1}`,
      description: request.description.trim(),
      status,
      fmeaEntryId,
      lastUpdatedAt: now,
    });
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return jsonResponse(404, { message: 'FMEA item not found.' });
    }
    console.error('Failed to create FMEA action item in DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to create action item.' });
  }
};

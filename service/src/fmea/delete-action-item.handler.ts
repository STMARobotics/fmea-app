import {
  ConditionalCheckFailedException,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  dynamoDB,
  emptyResponse,
  findFmeaById,
  getFmeaKey,
  getPathParameter,
  getTableName,
  jsonResponse,
  parseRequestBody,
  type HttpEvent,
} from './fmea-utils';

export const handler = async (event: HttpEvent) => {
  const actionItemId = getPathParameter(event, 'actionItemId');
  const request = parseRequestBody(event.body);
  const separator = actionItemId?.lastIndexOf(':') ?? -1;
  const fmeaId = separator > 0 ? actionItemId?.slice(0, separator) : null;
  const actionIndex = separator > 0 ? Number(actionItemId?.slice(separator + 1)) : NaN;
  if (
    !actionItemId ||
    !fmeaId ||
    !Number.isSafeInteger(actionIndex) ||
    actionIndex < 0 ||
    typeof request?.expectedDescription !== 'string' ||
    request.expectedDescription.trim().length === 0
  ) {
    return jsonResponse(400, { message: 'A valid action item ID and description are required.' });
  }

  try {
    const existing = await findFmeaById(fmeaId);
    if (!existing) {
      return jsonResponse(404, { message: 'FMEA item not found.' });
    }

    const now = new Date().toISOString();
    await dynamoDB.send(new UpdateItemCommand({
      TableName: getTableName(),
      Key: getFmeaKey(existing),
      UpdateExpression: `SET #lastUpdated = :lastUpdated REMOVE #actionItems[${actionIndex}]`,
      ConditionExpression: `attribute_exists(#actionItems[${actionIndex}].#description) AND #actionItems[${actionIndex}].#description = :expectedDescription`,
      ExpressionAttributeNames: {
        '#actionItems': 'actionItems',
        '#description': 'description',
        '#lastUpdated': 'lastUpdated',
      },
      ExpressionAttributeValues: {
        ':expectedDescription': { S: request.expectedDescription },
        ':lastUpdated': { S: now },
      },
    }));

    return emptyResponse(204);
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return jsonResponse(404, { message: 'Action item not found.' });
    }
    console.error('Failed to delete FMEA action item in DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to delete action item.' });
  }
};

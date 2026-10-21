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
  const actionItemId = getPathParameter(event, 'actionItemId');
  const request = parseRequestBody(event.body);
  const separator = actionItemId?.lastIndexOf(':') ?? -1;
  const fmeaId = separator > 0 ? actionItemId?.slice(0, separator) : null;
  const actionIndex = separator > 0 ? Number(actionItemId?.slice(separator + 1)) : NaN;
  if (
    !request ||
    !fmeaId ||
    !Number.isSafeInteger(actionIndex) ||
    actionIndex < 0 ||
    request.fmeaEntryId !== fmeaId ||
    typeof request.description !== 'string' ||
    request.description.trim().length === 0 ||
    (request.expectedDescription !== undefined && typeof request.expectedDescription !== 'string') ||
    !isActionItemStatus(request.status)
  ) {
    return jsonResponse(400, { message: 'A valid action item ID, FMEA entry ID, description, and status are required.' });
  }

  try {
    const existing = await findFmeaById(fmeaId);
    if (!existing) {
      return jsonResponse(404, { message: 'FMEA item not found.' });
    }
    const key = getFmeaKey(existing);
    const now = new Date().toISOString();
    await dynamoDB.send(new UpdateItemCommand({
      TableName: getTableName(),
      Key: key,
      UpdateExpression: `SET #actionItems[${actionIndex}].#description = :description, #actionItems[${actionIndex}].#status = :status, #actionItems[${actionIndex}].#actionLastUpdated = :lastUpdated, #lastUpdated = :lastUpdated`,
      ConditionExpression: `attribute_exists(#actionItems[${actionIndex}].#description) AND #actionItems[${actionIndex}].#description = :expectedDescription`,
      ExpressionAttributeNames: {
        '#actionItems': 'actionItems',
        '#status': 'status',
        '#actionLastUpdated': 'lastUpdated',
        '#lastUpdated': 'lastUpdated',
        '#description': 'description',
      },
      ExpressionAttributeValues: {
        ':status': { S: request.status },
        ':description': { S: request.description.trim() },
        ':expectedDescription': { S: request.expectedDescription ?? request.description },
        ':lastUpdated': { S: now },
      },
    }));
    return jsonResponse(200, {
      id: actionItemId,
      description: request.description.trim(),
      status: request.status,
      fmeaEntryId: fmeaId,
      lastUpdatedAt: now,
    });
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return jsonResponse(404, { message: 'Action item not found.' });
    }
    console.error('Failed to update FMEA action item in DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to update action item.' });
  }
};

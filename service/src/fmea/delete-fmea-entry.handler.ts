import {
  ConditionalCheckFailedException,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  dynamoDB,
  emptyResponse,
  findFmeaById,
  getFmeaKey,
  getPathParameter,
  getTableName,
  jsonResponse,
  type HttpEvent,
} from './fmea-utils';

export const handler = async (event: HttpEvent) => {
  const fmeaId = getPathParameter(event, 'fmeaId');
  if (!fmeaId) {
    return jsonResponse(400, { message: 'An FMEA ID is required.' });
  }

  try {
    const existing = await findFmeaById(fmeaId);
    if (!existing) {
      return jsonResponse(404, { message: 'FMEA item not found.' });
    }
    const key = getFmeaKey(existing);
    await dynamoDB.send(new DeleteItemCommand({
      TableName: getTableName(),
      Key: key,
      ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)',
    }));
    return emptyResponse(204);
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return jsonResponse(404, { message: 'FMEA item not found.' });
    }
    console.error('Failed to delete FMEA entry from DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to delete FMEA item.' });
  }
};

import {
  ConditionalCheckFailedException,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  dynamoDB,
  emptyResponse,
  getTableName,
  getTeamId,
  jsonResponse,
  type HttpEvent,
} from './team-utils';

export const handler = async (event: HttpEvent) => {
  const teamId = getTeamId(event);
  if (!teamId) {
    return jsonResponse(400, { message: 'A team ID is required.' });
  }

  try {
    await dynamoDB.send(
      new DeleteItemCommand({
        TableName: getTableName(),
        Key: {
          pk: { S: `TEAM#${teamId}` },
          sk: { S: 'METADATA' },
        },
        ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)',
      }),
    );
    return emptyResponse(204);
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return jsonResponse(404, { message: 'Team not found.' });
    }
    console.error('Failed to delete team from DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to delete team.' });
  }
};

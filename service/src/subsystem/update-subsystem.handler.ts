import {
  ConditionalCheckFailedException,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  dynamoDB,
  getSubsystemId,
  getTableName,
  getTeamId,
  jsonResponse,
  parseRequestBody,
  readSubsystem,
  type HttpEvent,
} from './subsystem-utils';

export const handler = async (event: HttpEvent) => {
  const teamId = getTeamId(event);
  if (!teamId) {
    return jsonResponse(400, { message: 'A team ID is required.' });
  }
  const subsystemId = getSubsystemId(event);
  if (!subsystemId) {
    return jsonResponse(400, { message: 'A subsystem ID is required.' });
  }

  const request = parseRequestBody(event.body);
  if (!request || typeof request.name !== 'string' || request.name.trim().length === 0) {
    return jsonResponse(400, { message: 'Request body must include a non-empty name.' });
  }

  try {
    const result = await dynamoDB.send(new UpdateItemCommand({
      TableName: getTableName(),
      Key: {
        pk: { S: `TEAM#${teamId}` },
        sk: { S: `SUBSYSTEM#${subsystemId}` },
      },
      UpdateExpression: 'SET #name = :name',
      ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)',
      ExpressionAttributeNames: { '#name': 'name' },
      ExpressionAttributeValues: { ':name': { S: request.name.trim() } },
      ReturnValues: 'ALL_NEW',
    }));
    if (!result.Attributes) {
      throw new Error('DynamoDB did not return the updated subsystem.');
    }
    return jsonResponse(200, readSubsystem(result.Attributes));
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return jsonResponse(404, { message: 'Subsystem not found.' });
    }
    console.error('Failed to update subsystem in DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to update subsystem.' });
  }
};

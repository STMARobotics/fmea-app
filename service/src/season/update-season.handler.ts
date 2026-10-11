import {
  ConditionalCheckFailedException,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  dynamoDB,
  getSeasonId,
  getTableName,
  jsonResponse,
  isProgram,
  parseRequestBody,
  readSeason,
  type HttpEvent,
} from './season-utils';

export const handler = async (event: HttpEvent) => {
  const seasonId = getSeasonId(event);
  if (!seasonId) {
    return jsonResponse(400, { message: 'A season ID is required.' });
  }

  const request = parseRequestBody(event.body);
  if (!request) {
    return jsonResponse(400, { message: 'Request body must be valid JSON.' });
  }

  const updates: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, { S: string }> = {};
  if (request.program !== undefined) {
    if (!isProgram(request.program)) {
      return jsonResponse(400, { message: 'Program must be "frc" or "ftc".' });
    }
    updates.push('#program = :program');
    expressionAttributeNames['#program'] = 'program';
    expressionAttributeValues[':program'] = { S: request.program };
  }
  if (request.name !== undefined) {
    if (typeof request.name !== 'string' || request.name.trim().length === 0) {
      return jsonResponse(400, { message: 'Name must be a non-empty string.' });
    }
    updates.push('#name = :name');
    expressionAttributeNames['#name'] = 'name';
    expressionAttributeValues[':name'] = { S: request.name.trim() };
  }
  if (updates.length === 0) {
    return jsonResponse(400, {
      message: 'Request body must include a program and/or name to update.',
    });
  }

  try {
    const result = await dynamoDB.send(
      new UpdateItemCommand({
        TableName: getTableName(),
        Key: {
          pk: { S: `SEASON#${seasonId}` },
          sk: { S: 'METADATA' },
        },
        UpdateExpression: `SET ${updates.join(', ')}`,
        ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)',
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      }),
    );
    if (!result.Attributes) {
      throw new Error('DynamoDB did not return the updated season.');
    }
    return jsonResponse(200, readSeason(result.Attributes));
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return jsonResponse(404, { message: 'Season not found.' });
    }
    console.error('Failed to update season in DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to update season.' });
  }
};

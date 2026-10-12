import {
  ConditionalCheckFailedException,
  UpdateItemCommand,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb';
import {
  dynamoDB,
  getTableName,
  getTeamId,
  isProgram,
  isTeamNumber,
  jsonResponse,
  parseRequestBody,
  readTeam,
  type HttpEvent,
} from './team-utils';

export const handler = async (event: HttpEvent) => {
  const teamId = getTeamId(event);
  if (!teamId) {
    return jsonResponse(400, { message: 'A team ID is required.' });
  }

  const request = parseRequestBody(event.body);
  if (!request) {
    return jsonResponse(400, { message: 'Request body must be valid JSON.' });
  }

  const updates: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, AttributeValue> = {};
  if (request.program !== undefined) {
    if (!isProgram(request.program)) {
      return jsonResponse(400, { message: 'Program must be "frc" or "ftc".' });
    }
    updates.push('#program = :program');
    expressionAttributeNames['#program'] = 'program';
    expressionAttributeValues[':program'] = { S: request.program };
  }
  if (request.teamNumber !== undefined) {
    if (!isTeamNumber(request.teamNumber)) {
      return jsonResponse(400, { message: 'Team number must be a positive integer.' });
    }
    updates.push('#teamNumber = :teamNumber');
    expressionAttributeNames['#teamNumber'] = 'teamNumber';
    expressionAttributeValues[':teamNumber'] = { N: String(request.teamNumber) };
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
      message: 'Request body must include a program, teamNumber, and/or name to update.',
    });
  }

  try {
    const result = await dynamoDB.send(
      new UpdateItemCommand({
        TableName: getTableName(),
        Key: {
          pk: { S: `TEAM#${teamId}` },
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
      throw new Error('DynamoDB did not return the updated team.');
    }
    return jsonResponse(200, readTeam(result.Attributes));
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return jsonResponse(404, { message: 'Team not found.' });
    }
    console.error('Failed to update team in DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to update team.' });
  }
};

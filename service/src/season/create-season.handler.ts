import { PutItemCommand } from '@aws-sdk/client-dynamodb';
import {
  createSeasonId,
  dynamoDB,
  getTableName,
  jsonResponse,
  parseRequestBody,
  seasonItem,
  type HttpEvent,
} from './season-utils';

export const handler = async (event: HttpEvent) => {
  const request = parseRequestBody(event.body);
  if (
    !request ||
    (request.program !== 'frc' && request.program !== 'ftc') ||
    typeof request.name !== 'string' ||
    request.name.trim().length === 0
  ) {
    return jsonResponse(400, {
      message: 'Request body must include program ("frc" or "ftc") and a non-empty name.',
    });
  }

  const seasonId = createSeasonId();
  const name = request.name.trim();
  try {
    await dynamoDB.send(
      new PutItemCommand({
        TableName: getTableName(),
        Item: seasonItem(seasonId, request.program, name),
        ConditionExpression: 'attribute_not_exists(pk)',
      }),
    );
  } catch (error) {
    console.error('Failed to create season in DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to create season.' });
  }

  return jsonResponse(201, { id: seasonId, program: request.program, name });
};

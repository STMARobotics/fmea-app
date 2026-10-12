import {
  GetItemCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  createSubsystemId,
  dynamoDB,
  getTableName,
  getTeamId,
  jsonResponse,
  parseRequestBody,
  type HttpEvent,
} from './subsystem-utils';

export const handler = async (event: HttpEvent) => {
  const teamId = getTeamId(event);
  if (!teamId) {
    return jsonResponse(400, { message: 'A team ID is required.' });
  }

  const request = parseRequestBody(event.body);
  if (
    !request ||
    typeof request.seasonId !== 'string' ||
    request.seasonId.trim().length === 0 ||
    typeof request.name !== 'string' ||
    request.name.trim().length === 0
  ) {
    return jsonResponse(400, {
      message: 'Request body must include a seasonId and a non-empty name.',
    });
  }

  const seasonId = request.seasonId.trim();
  const name = request.name.trim();
  try {
    const [teamResult, seasonResult] = await Promise.all([
      dynamoDB.send(new GetItemCommand({
        TableName: getTableName(),
        Key: {
          pk: { S: `TEAM#${teamId}` },
          sk: { S: 'METADATA' },
        },
        ConsistentRead: true,
      })),
      dynamoDB.send(new GetItemCommand({
        TableName: getTableName(),
        Key: {
          pk: { S: `SEASON#${seasonId}` },
          sk: { S: 'METADATA' },
        },
        ConsistentRead: true,
      })),
    ]);
    if (!teamResult.Item) {
      return jsonResponse(404, { message: 'Team not found.' });
    }
    if (!seasonResult.Item) {
      return jsonResponse(404, { message: 'Season not found.' });
    }

    const id = createSubsystemId();
    await dynamoDB.send(new PutItemCommand({
      TableName: getTableName(),
      Item: {
        pk: { S: `TEAM#${teamId}` },
        sk: { S: `SUBSYSTEM#${id}` },
        seasonId: { S: seasonId },
        name: { S: name },
      },
      ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
    }));
    return jsonResponse(201, { id, teamId, seasonId, name });
  } catch (error) {
    console.error('Failed to create subsystem in DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to create subsystem.' });
  }
};

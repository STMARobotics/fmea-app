import {
  QueryCommand,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb';
import {
  dynamoDB,
  getTableName,
  getTeamId,
  jsonResponse,
  readSubsystem,
  type HttpEvent,
} from './subsystem-utils';

export const handler = async (event: HttpEvent) => {
  const teamId = getTeamId(event);
  if (!teamId) {
    return jsonResponse(400, { message: 'A team ID is required.' });
  }

  try {
    const items: Record<string, AttributeValue>[] = [];
    let exclusiveStartKey: Record<string, AttributeValue> | undefined;
    do {
      const result = await dynamoDB.send(new QueryCommand({
        TableName: getTableName(),
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :subsystemPrefix)',
        ExpressionAttributeValues: {
          ':pk': { S: `TEAM#${teamId}` },
          ':subsystemPrefix': { S: 'SUBSYSTEM#' },
        },
        ConsistentRead: true,
        ExclusiveStartKey: exclusiveStartKey,
      }));
      items.push(...(result.Items ?? []));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);
    return jsonResponse(200, items.map(readSubsystem));
  } catch (error) {
    console.error('Failed to list subsystems from DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to load subsystems.' });
  }
};

import { GetItemCommand } from '@aws-sdk/client-dynamodb';
import {
  dynamoDB,
  getTableName,
  getTeamId,
  jsonResponse,
  readTeam,
  type HttpEvent,
} from './team-utils';

export const handler = async (event: HttpEvent) => {
  const teamId = getTeamId(event);
  if (!teamId) {
    return jsonResponse(400, { message: 'A team ID is required.' });
  }

  try {
    const result = await dynamoDB.send(
      new GetItemCommand({
        TableName: getTableName(),
        Key: {
          pk: { S: `TEAM#${teamId}` },
          sk: { S: 'METADATA' },
        },
        ConsistentRead: true,
      }),
    );
    if (!result.Item) {
      return jsonResponse(404, { message: 'Team not found.' });
    }
    return jsonResponse(200, readTeam(result.Item));
  } catch (error) {
    console.error('Failed to load team from DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to load team.' });
  }
};

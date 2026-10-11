import { GetItemCommand } from '@aws-sdk/client-dynamodb';
import {
  dynamoDB,
  getSeasonId,
  getTableName,
  jsonResponse,
  readSeason,
  type HttpEvent,
} from './season-utils';

export const handler = async (event: HttpEvent) => {
  const seasonId = getSeasonId(event);
  if (!seasonId) {
    return jsonResponse(400, { message: 'A season ID is required.' });
  }

  try {
    const result = await dynamoDB.send(
      new GetItemCommand({
        TableName: getTableName(),
        Key: {
          pk: { S: `SEASON#${seasonId}` },
          sk: { S: 'METADATA' },
        },
        ConsistentRead: true,
      }),
    );
    if (!result.Item) {
      return jsonResponse(404, { message: 'Season not found.' });
    }
    return jsonResponse(200, readSeason(result.Item));
  } catch (error) {
    console.error('Failed to load season from DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to load season.' });
  }
};

import {
  QueryCommand,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb';
import {
  dynamoDB,
  fmeaTeamSeasonIndexName,
  formatFmeaEntry,
  getPathParameter,
  getTableName,
  jsonResponse,
  readFmea,
  type HttpEvent,
} from './fmea-utils';

export const handler = async (event: HttpEvent) => {
  const teamId = getPathParameter(event, 'teamId');
  const seasonId = getPathParameter(event, 'seasonId');
  if (!teamId || !seasonId) {
    return jsonResponse(400, { message: 'A team ID and season ID are required.' });
  }

  try {
    const items: Record<string, AttributeValue>[] = [];
    let exclusiveStartKey: Record<string, AttributeValue> | undefined;
    do {
      const result = await dynamoDB.send(new QueryCommand({
        TableName: getTableName(),
        IndexName: fmeaTeamSeasonIndexName,
        KeyConditionExpression: 'gsi2pk = :partition',
        ExpressionAttributeValues: {
          ':partition': { S: `TEAM#${teamId}#SEASON#${seasonId}` },
        },
        ExclusiveStartKey: exclusiveStartKey,
      }));
      items.push(...(result.Items ?? []));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    const entries = await Promise.all(items.map(async item =>
      formatFmeaEntry(readFmea(item)),
    ));
    return jsonResponse(200, entries);
  } catch (error) {
    console.error('Failed to list FMEA entries from DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to load FMEA items.' });
  }
};

import {
  QueryCommand,
  type AttributeValue,
  type QueryCommandOutput,
} from '@aws-sdk/client-dynamodb';
import {
  dynamoDB,
  getTableName,
  jsonResponse,
  readSeason,
  seasonIndexName,
  type HttpEvent,
  type Season,
} from './season-utils';

export const handler = async (event: HttpEvent) => {
  const program = event.queryStringParameters?.program;
  if (program !== undefined && program !== 'frc' && program !== 'ftc') {
    return jsonResponse(400, { message: 'Program must be "frc" or "ftc".' });
  }

  try {
    const seasons: Season[] = [];
    let exclusiveStartKey: Record<string, AttributeValue> | undefined;
    do {
      const result: QueryCommandOutput = await dynamoDB.send(
        new QueryCommand({
          TableName: getTableName(),
          IndexName: seasonIndexName,
          KeyConditionExpression: 'gsi1pk = :seasonPartition',
          ExpressionAttributeValues: {
            ':seasonPartition': { S: 'SEASONS' },
          },
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );
      for (const item of result.Items ?? []) {
        const season = readSeason(item);
        if (program === undefined || season.program === program) {
          seasons.push(season);
        }
      }
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return jsonResponse(200, seasons);
  } catch (error) {
    console.error('Failed to list seasons from DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to load seasons.' });
  }
};

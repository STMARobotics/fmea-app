import {
  QueryCommand,
  type AttributeValue,
  type QueryCommandOutput,
} from '@aws-sdk/client-dynamodb';
import {
  dynamoDB,
  getTableName,
  isProgram,
  jsonResponse,
  readTeam,
  teamIndexName,
  type HttpEvent,
  type Team,
} from './team-utils';

export const handler = async (event: HttpEvent) => {
  const program = event.queryStringParameters?.program;
  if (program !== undefined && !isProgram(program)) {
    return jsonResponse(400, { message: 'Program must be "frc" or "ftc".' });
  }

  try {
    const teams: Team[] = [];
    let exclusiveStartKey: Record<string, AttributeValue> | undefined;
    do {
      const result: QueryCommandOutput = await dynamoDB.send(
        new QueryCommand({
          TableName: getTableName(),
          IndexName: teamIndexName,
          KeyConditionExpression: 'gsi1pk = :teamPartition',
          ExpressionAttributeValues: {
            ':teamPartition': { S: 'TEAMS' },
          },
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );
      for (const item of result.Items ?? []) {
        const team = readTeam(item);
        if (program === undefined || team.program === program) {
          teams.push(team);
        }
      }
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return jsonResponse(200, teams);
  } catch (error) {
    console.error('Failed to list teams from DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to load teams.' });
  }
};

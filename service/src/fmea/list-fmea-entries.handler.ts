import {
  QueryCommand,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb';
import {
  dynamoDB,
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
    let subsystemStartKey: Record<string, AttributeValue> | undefined;
    do {
      const subsystemResult = await dynamoDB.send(new QueryCommand({
        TableName: getTableName(),
        KeyConditionExpression: 'pk = :team AND begins_with(sk, :subsystemPrefix)',
        ExpressionAttributeValues: {
          ':team': { S: `TEAM#${teamId}` },
          ':subsystemPrefix': { S: 'SUBSYSTEM#' },
        },
        ConsistentRead: true,
        ExclusiveStartKey: subsystemStartKey,
      }));
      for (const subsystemItem of subsystemResult.Items ?? []) {
        const subsystemId = subsystemItem.sk?.S?.startsWith('SUBSYSTEM#')
          ? subsystemItem.sk.S.slice('SUBSYSTEM#'.length)
          : null;
        if (!subsystemId) {
          throw new Error('DynamoDB returned a malformed subsystem key.');
        }

        let fmeaStartKey: Record<string, AttributeValue> | undefined;
        do {
          const fmeaResult = await dynamoDB.send(new QueryCommand({
            TableName: getTableName(),
            KeyConditionExpression: 'pk = :subsystem AND begins_with(sk, :fmeaPrefix)',
            ExpressionAttributeValues: {
              ':subsystem': { S: `SUBSYSTEM#${subsystemId}` },
              ':fmeaPrefix': { S: 'FMEA#' },
            },
            ConsistentRead: true,
            ExclusiveStartKey: fmeaStartKey,
          }));
          items.push(...(fmeaResult.Items ?? []).filter(item => item.seasonId?.S === seasonId));
          fmeaStartKey = fmeaResult.LastEvaluatedKey;
        } while (fmeaStartKey);
      }
      subsystemStartKey = subsystemResult.LastEvaluatedKey;
    } while (subsystemStartKey);

    const entries = await Promise.all(items.map(async item =>
      formatFmeaEntry(readFmea(item)),
    ));
    return jsonResponse(200, entries);
  } catch (error) {
    console.error('Failed to list FMEA entries from DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to load FMEA items.' });
  }
};

import {
  BatchWriteItemCommand,
  QueryCommand,
  type AttributeValue,
  type WriteRequest,
} from '@aws-sdk/client-dynamodb';
import {
  dynamoDB,
  emptyResponse,
  getSeasonId,
  getTableName,
  jsonResponse,
  type HttpEvent,
} from './season-utils';

const deletePartition = async (tableName: string, seasonId: string) => {
  let exclusiveStartKey: Record<string, AttributeValue> | undefined;
  do {
    const result = await dynamoDB.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'pk = :seasonKey',
        ExpressionAttributeValues: {
          ':seasonKey': { S: `SEASON#${seasonId}` },
        },
        ConsistentRead: true,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );
    const items = result.Items ?? [];
    for (let index = 0; index < items.length; index += 25) {
      const batch: WriteRequest[] = items.slice(index, index + 25).map(item => {
        if (!item.pk || !item.sk) {
          throw new Error('DynamoDB returned a season record without primary keys.');
        }
        return {
          DeleteRequest: {
            Key: {
              pk: item.pk,
              sk: item.sk,
            },
          },
        };
      });
      let pending: WriteRequest[] = batch;
      for (let attempt = 0; pending.length > 0 && attempt < 5; attempt += 1) {
        const response = await dynamoDB.send(
          new BatchWriteItemCommand({
            RequestItems: { [tableName]: pending },
          }),
        );
        pending = response.UnprocessedItems?.[tableName] ?? [];
        if (pending.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 50 * 2 ** attempt));
        }
      }
      if (pending.length > 0) {
        throw new Error(`DynamoDB did not process all deletes for season ${seasonId}.`);
      }
    }
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);
};

export const handler = async (event: HttpEvent) => {
  const seasonId = getSeasonId(event);
  if (!seasonId) {
    return jsonResponse(400, { message: 'A season ID is required.' });
  }

  try {
    const tableName = getTableName();
    await deletePartition(tableName, seasonId);
    return emptyResponse(204);
  } catch (error) {
    console.error('Failed to delete season from DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to delete season.' });
  }
};

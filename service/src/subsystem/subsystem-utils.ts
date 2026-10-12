import {
  DynamoDBClient,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb';

export const dynamoDB = new DynamoDBClient({});

export type HttpEvent = {
  pathParameters?: Record<string, string | undefined> | null;
};

export const jsonResponse = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(body),
});

export const getTableName = (): string => {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new Error('TABLE_NAME environment variable is not configured.');
  }
  return tableName;
};

export const getTeamId = (event: HttpEvent): string | null => {
  const teamId = event.pathParameters?.teamId;
  return teamId && teamId.trim().length > 0 ? teamId : null;
};

export const readSubsystem = (item: Record<string, AttributeValue>) => {
  const pk = item.pk?.S;
  const sk = item.sk?.S;
  const seasonId = item.seasonId?.S;
  const name = item.name?.S;
  if (!pk?.startsWith('TEAM#') || !sk?.startsWith('SUBSYSTEM#') || !seasonId || !name) {
    throw new Error('DynamoDB returned a malformed subsystem item.');
  }
  return {
    id: sk.slice('SUBSYSTEM#'.length),
    teamId: pk.slice('TEAM#'.length),
    seasonId,
    name,
  };
};

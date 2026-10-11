import { randomUUID } from 'node:crypto';
import {
  DynamoDBClient,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb';

export const dynamoDB = new DynamoDBClient({});
export const seasonIndexName = 'GSI1';
export type Program = 'frc' | 'ftc';

export type Season = {
  id: string;
  program: Program;
  name: string;
};

export type HttpEvent = {
  body?: string | null;
  pathParameters?: Record<string, string | undefined> | null;
  queryStringParameters?: Record<string, string | undefined> | null;
};

export type SeasonRequest = {
  program?: unknown;
  name?: unknown;
};

export const jsonResponse = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(body),
});

export const emptyResponse = (statusCode: number) => ({
  statusCode,
  headers: {
    'Access-Control-Allow-Origin': '*',
  },
  body: '',
});

export const getTableName = (): string => {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new Error('TABLE_NAME environment variable is not configured.');
  }
  return tableName;
};

export const parseRequestBody = (body?: string | null): SeasonRequest | null => {
  try {
    const parsed: unknown = JSON.parse(body ?? '');
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as SeasonRequest;
  } catch {
    return null;
  }
};

export const isProgram = (value: unknown): value is Program =>
  value === 'frc' || value === 'ftc';

export const readSeason = (item: Record<string, AttributeValue>): Season => {
  const pk = item.pk?.S;
  const program = item.program?.S;
  const name = item.name?.S;
  if (!pk?.startsWith('SEASON#') || !isProgram(program) || name === undefined) {
    throw new Error('DynamoDB returned a malformed season metadata item.');
  }
  return { id: pk.slice('SEASON#'.length), program, name };
};

export const createSeasonId = (): string => randomUUID();

export const seasonItem = (
  seasonId: string,
  program: Program,
  name: string,
): Record<string, AttributeValue> => ({
  // Season-owned records share this partition so deletes can cascade by PK.
  pk: { S: `SEASON#${seasonId}` },
  sk: { S: 'METADATA' },
  gsi1pk: { S: 'SEASONS' },
  gsi1sk: { S: seasonId },
  program: { S: program },
  name: { S: name },
});

export const getSeasonId = (event: HttpEvent): string | null => {
  const seasonId = event.pathParameters?.seasonId;
  return seasonId && seasonId.trim().length > 0 ? seasonId : null;
};

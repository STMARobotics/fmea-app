import { randomUUID } from 'node:crypto';
import {
  DynamoDBClient,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb';

export const dynamoDB = new DynamoDBClient({});
export const teamIndexName = 'GSI1';
export type Program = 'frc' | 'ftc';

export type Team = {
  id: string;
  program: Program;
  teamNumber: number;
  name: string;
};

export type HttpEvent = {
  body?: string | null;
  pathParameters?: Record<string, string | undefined> | null;
  queryStringParameters?: Record<string, string | undefined> | null;
};

export type TeamRequest = {
  program?: unknown;
  teamNumber?: unknown;
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

export const parseRequestBody = (body?: string | null): TeamRequest | null => {
  try {
    const parsed: unknown = JSON.parse(body ?? '');
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as TeamRequest;
  } catch {
    return null;
  }
};

export const isProgram = (value: unknown): value is Program =>
  value === 'frc' || value === 'ftc';

export const isTeamNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

export const readTeam = (item: Record<string, AttributeValue>): Team => {
  const pk = item.pk?.S;
  const program = item.program?.S;
  const teamNumber = item.teamNumber?.N;
  const name = item.name?.S;
  const parsedTeamNumber = teamNumber === undefined ? NaN : Number(teamNumber);
  if (
    !pk?.startsWith('TEAM#') ||
    !isProgram(program) ||
    !isTeamNumber(parsedTeamNumber) ||
    name === undefined
  ) {
    throw new Error('DynamoDB returned a malformed team metadata item.');
  }
  return { id: pk.slice('TEAM#'.length), program, teamNumber: parsedTeamNumber, name };
};

export const createTeamId = (): string => randomUUID();

export const teamItem = (
  teamId: string,
  program: Program,
  teamNumber: number,
  name: string,
): Record<string, AttributeValue> => ({
  pk: { S: `TEAM#${teamId}` },
  sk: { S: 'METADATA' },
  gsi1pk: { S: 'TEAMS' },
  gsi1sk: { S: teamId },
  program: { S: program },
  teamNumber: { N: String(teamNumber) },
  name: { S: name },
});

export const getTeamId = (event: HttpEvent): string | null => {
  const teamId = event.pathParameters?.teamId;
  return teamId && teamId.trim().length > 0 ? teamId : null;
};

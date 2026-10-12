import { randomUUID } from 'node:crypto';
import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb';

export const dynamoDB = new DynamoDBClient({});
export const fmeaIdIndexName = 'GSI2';

export type ActionItemStatus = 'not_started' | 'in_progress' | 'assembly_note' | 'complete';
export type HttpEvent = {
  body?: string | null;
  pathParameters?: Record<string, string | undefined> | null;
  queryStringParameters?: Record<string, string | undefined> | null;
};
export type FmeaRequest = Record<string, unknown>;
export type ValidFmeaRequest = {
  teamId?: unknown;
  seasonId?: unknown;
  subsystemId: string;
  failureMode: string;
  failureEffect: string;
  sev: number;
  potentialCauses: string;
  occ: number;
  currentProcessControls: string;
  det: number;
};
export type ValidCreateFmeaRequest = ValidFmeaRequest & {
  teamId: string;
  seasonId: string;
};

export type FmeaData = {
  id: string;
  subsystemId: string;
  teamId: string;
  seasonId: string;
  failureMode: string;
  failureEffect: string;
  sev: number;
  potentialCauses: string;
  occ: number;
  currentProcessControls: string;
  det: number;
  lastUpdatedAt: string;
  actionItems: {
    id: string;
    description: string;
    status: ActionItemStatus;
    fmeaEntryId: string;
    lastUpdatedAt: string;
  }[];
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
  headers: { 'Access-Control-Allow-Origin': '*' },
  body: '',
});

export const getTableName = (): string => {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new Error('TABLE_NAME environment variable is not configured.');
  }
  return tableName;
};

export const parseRequestBody = (body?: string | null): FmeaRequest | null => {
  try {
    const parsed: unknown = JSON.parse(body ?? '');
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as FmeaRequest
      : null;
  } catch {
    return null;
  }
};

export const getPathParameter = (event: HttpEvent, name: string): string | null => {
  const value = event.pathParameters?.[name];
  return value && value.trim().length > 0 ? value : null;
};

export const createFmeaId = (): string => randomUUID();

export const isRating = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10;

export const isActionItemStatus = (value: unknown): value is ActionItemStatus =>
  value === 'not_started' || value === 'in_progress' ||
  value === 'assembly_note' || value === 'complete';

export const isFmeaRequest = (request: FmeaRequest): request is ValidFmeaRequest =>
  typeof request.subsystemId === 'string' && request.subsystemId.trim().length > 0 &&
  typeof request.failureMode === 'string' && request.failureMode.trim().length > 0 &&
  typeof request.failureEffect === 'string' && request.failureEffect.trim().length > 0 &&
  isRating(request.sev) &&
  typeof request.potentialCauses === 'string' &&
  isRating(request.occ) &&
  typeof request.currentProcessControls === 'string' &&
  isRating(request.det);

export const isCreateFmeaRequest = (
  request: FmeaRequest,
): request is ValidCreateFmeaRequest =>
  isFmeaRequest(request) &&
  typeof request.teamId === 'string' && request.teamId.trim().length > 0 &&
  typeof request.seasonId === 'string' && request.seasonId.trim().length > 0;

const requiredString = (item: Record<string, AttributeValue>, key: string): string => {
  const value = item[key]?.S;
  if (value === undefined) {
    throw new Error(`DynamoDB returned an FMEA item without ${key}.`);
  }
  return value;
};

const requiredRating = (item: Record<string, AttributeValue>, key: string): number => {
  const value = Number(item[key]?.N);
  if (!isRating(value)) {
    throw new Error(`DynamoDB returned an FMEA item with an invalid ${key}.`);
  }
  return value;
};

export const readFmea = (item: Record<string, AttributeValue>): FmeaData => {
  const pk = requiredString(item, 'pk');
  const sk = requiredString(item, 'sk');
  const id = sk.startsWith('FMEA#') ? sk.slice('FMEA#'.length) : '';
  const subsystemId = pk.startsWith('SUBSYSTEM#') ? pk.slice('SUBSYSTEM#'.length) : '';
  const actionItems = item.actionItems?.L;
  if (!id || !subsystemId || !actionItems) {
    throw new Error('DynamoDB returned a malformed FMEA item.');
  }

  return {
    id,
    subsystemId,
    teamId: requiredString(item, 'teamId'),
    seasonId: requiredString(item, 'seasonId'),
    failureMode: requiredString(item, 'failureMode'),
    failureEffect: requiredString(item, 'failureEffect'),
    sev: requiredRating(item, 'sev'),
    potentialCauses: requiredString(item, 'potentialCauses'),
    occ: requiredRating(item, 'occ'),
    currentProcessControls: requiredString(item, 'currentProcessControls'),
    det: requiredRating(item, 'det'),
    lastUpdatedAt: requiredString(item, 'lastUpdated'),
    actionItems: actionItems.map((attribute, index) => {
      const actionItem = attribute.M;
      const description = actionItem?.description?.S;
      const status = actionItem?.status?.S;
      const lastUpdatedAt = actionItem?.lastUpdated?.S;
      if (
        !actionItem ||
        description === undefined ||
        !isActionItemStatus(status) ||
        lastUpdatedAt === undefined
      ) {
        throw new Error('DynamoDB returned a malformed FMEA action item.');
      }
      return {
        id: `${id}:${index}`,
        description,
        status,
        fmeaEntryId: id,
        lastUpdatedAt,
      };
    }),
  };
};

export const getFmeaKey = (
  item: Record<string, AttributeValue>,
): { pk: AttributeValue; sk: AttributeValue } => {
  const pk = item.pk;
  const sk = item.sk;
  if (!pk?.S?.startsWith('SUBSYSTEM#') || !sk?.S?.startsWith('FMEA#')) {
    throw new Error('DynamoDB returned malformed FMEA primary keys.');
  }
  return { pk, sk };
};

export const fmeaItem = (
  id: string,
  request: ValidCreateFmeaRequest,
  teamId: string,
  seasonId: string,
  now: string,
): Record<string, AttributeValue> => ({
  pk: { S: `SUBSYSTEM#${request.subsystemId}` },
  sk: { S: `FMEA#${id}` },
  teamId: { S: teamId },
  seasonId: { S: seasonId },
  gsi2pk: { S: `FMEA#${id}` },
  gsi2sk: { S: 'METADATA' },
  failureMode: { S: request.failureMode.trim() },
  failureEffect: { S: request.failureEffect.trim() },
  sev: { N: String(request.sev) },
  potentialCauses: { S: request.potentialCauses },
  occ: { N: String(request.occ) },
  currentProcessControls: { S: request.currentProcessControls },
  det: { N: String(request.det) },
  lastUpdated: { S: now },
  actionItems: { L: [] },
});

export const readSubsystemMetadata = (item: Record<string, AttributeValue>) => {
  const pk = item.pk?.S;
  const sk = item.sk?.S;
  const seasonId = item.seasonId?.S;
  const name = item.name?.S;
  if (!pk?.startsWith('TEAM#') || !sk?.startsWith('SUBSYSTEM#') || !seasonId || !name) {
    throw new Error('DynamoDB returned a malformed subsystem item.');
  }
  return { id: sk.slice('SUBSYSTEM#'.length), teamId: pk.slice('TEAM#'.length), seasonId, name };
};

export const readTeamMetadata = (item: Record<string, AttributeValue>) => {
  const pk = item.pk?.S;
  const program = item.program?.S;
  const teamNumber = Number(item.teamNumber?.N);
  const teamName = item.name?.S;
  if (
    !pk?.startsWith('TEAM#') ||
    (program !== 'frc' && program !== 'ftc') ||
    !Number.isSafeInteger(teamNumber) ||
    teamName === undefined
  ) {
    throw new Error('DynamoDB returned a malformed team metadata item.');
  }
  return { id: pk.slice('TEAM#'.length), program, teamNumber, teamName };
};

export const findFmeaById = async (
  id: string,
): Promise<Record<string, AttributeValue> | undefined> => {
  const result = await dynamoDB.send(new QueryCommand({
    TableName: getTableName(),
    IndexName: fmeaIdIndexName,
    KeyConditionExpression: 'gsi2pk = :partition AND gsi2sk = :metadata',
    ExpressionAttributeValues: {
      ':partition': { S: `FMEA#${id}` },
      ':metadata': { S: 'METADATA' },
    },
    Limit: 1,
  }));
  return result.Items?.[0];
};

export const formatFmeaEntry = async (data: FmeaData) => {
  const [subsystemResult, teamResult] = await Promise.all([
    dynamoDB.send(new GetItemCommand({
      TableName: getTableName(),
      Key: {
        pk: { S: `TEAM#${data.teamId}` },
        sk: { S: `SUBSYSTEM#${data.subsystemId}` },
      },
      ConsistentRead: true,
    })),
    dynamoDB.send(new GetItemCommand({
      TableName: getTableName(),
      Key: {
        pk: { S: `TEAM#${data.teamId}` },
        sk: { S: 'METADATA' },
      },
      ConsistentRead: true,
    })),
  ]);
  if (!subsystemResult.Item || !teamResult.Item) {
    throw new Error('FMEA entry is missing its subsystem or team metadata.');
  }
  const subsystem = readSubsystemMetadata(subsystemResult.Item);
  const team = readTeamMetadata(teamResult.Item);
  return {
    id: data.id,
    team,
    subsystem: { id: subsystem.id, name: subsystem.name },
    failureMode: data.failureMode,
    failureEffect: data.failureEffect,
    sev: data.sev,
    potentialCauses: data.potentialCauses,
    occ: data.occ,
    currentProcessControls: data.currentProcessControls,
    det: data.det,
    lastUpdatedAt: data.lastUpdatedAt,
    actionItems: data.actionItems,
  };
};

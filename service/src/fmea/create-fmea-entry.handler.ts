import {
  GetItemCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  createFmeaId,
  dynamoDB,
  fmeaItem,
  formatFmeaEntry,
  getTableName,
  isCreateFmeaRequest,
  jsonResponse,
  parseRequestBody,
  readFmea,
  readSubsystemMetadata,
  type HttpEvent,
} from './fmea-utils';

export const handler = async (event: HttpEvent) => {
  const request = parseRequestBody(event.body);
  if (!request || !isCreateFmeaRequest(request)) {
    return jsonResponse(400, {
      message: 'Request body must include teamId, seasonId, subsystemId, non-empty failureMode and failureEffect, string cause/control fields, and integer sev, occ, and det ratings from 1 to 10.',
    });
  }

  try {
    const subsystemResult = await dynamoDB.send(new GetItemCommand({
      TableName: getTableName(),
      Key: {
        pk: { S: `TEAM#${request.teamId}` },
        sk: { S: `SUBSYSTEM#${request.subsystemId}` },
      },
      ConsistentRead: true,
    }));
    if (!subsystemResult.Item) {
      return jsonResponse(404, { message: 'Subsystem not found.' });
    }

    const subsystem = readSubsystemMetadata(subsystemResult.Item);
    if (subsystem.seasonId !== request.seasonId) {
      return jsonResponse(400, { message: 'The subsystem does not belong to the selected season.' });
    }
    const now = new Date().toISOString();
    const id = createFmeaId();
    const item = fmeaItem(id, request, subsystem.teamId, subsystem.seasonId, now);
    await dynamoDB.send(new PutItemCommand({
      TableName: getTableName(),
      Item: item,
      ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
    }));
    return jsonResponse(201, await formatFmeaEntry(readFmea(item)));
  } catch (error) {
    console.error('Failed to create FMEA entry in DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to create FMEA item.' });
  }
};

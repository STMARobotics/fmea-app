import {
  ConditionalCheckFailedException,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  dynamoDB,
  findFmeaById,
  formatFmeaEntry,
  getFmeaKey,
  getPathParameter,
  getTableName,
  isFmeaRequest,
  jsonResponse,
  parseRequestBody,
  readFmea,
  type HttpEvent,
} from './fmea-utils';

export const handler = async (event: HttpEvent) => {
  const fmeaId = getPathParameter(event, 'fmeaId');
  if (!fmeaId) {
    return jsonResponse(400, { message: 'An FMEA ID is required.' });
  }
  const request = parseRequestBody(event.body);
  if (!request || !isFmeaRequest(request)) {
    return jsonResponse(400, {
      message: 'Request body must include a subsystemId, non-empty failureMode and failureEffect, string cause/control fields, and integer sev, occ, and det ratings from 1 to 10.',
    });
  }

  try {
    const existing = await findFmeaById(fmeaId);
    if (!existing) {
      return jsonResponse(404, { message: 'FMEA item not found.' });
    }
    const key = getFmeaKey(existing);
    if (key.pk.S !== `SUBSYSTEM#${request.subsystemId}`) {
      return jsonResponse(400, { message: 'An FMEA item cannot be moved to another subsystem.' });
    }

    const now = new Date().toISOString();
    const result = await dynamoDB.send(new UpdateItemCommand({
      TableName: getTableName(),
      Key: key,
      UpdateExpression: 'SET failureMode = :failureMode, failureEffect = :failureEffect, sev = :sev, potentialCauses = :potentialCauses, occ = :occ, currentProcessControls = :currentProcessControls, det = :det, lastUpdated = :lastUpdated',
      ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)',
      ExpressionAttributeValues: {
        ':failureMode': { S: request.failureMode.trim() },
        ':failureEffect': { S: request.failureEffect.trim() },
        ':sev': { N: String(request.sev) },
        ':potentialCauses': { S: request.potentialCauses },
        ':occ': { N: String(request.occ) },
        ':currentProcessControls': { S: request.currentProcessControls },
        ':det': { N: String(request.det) },
        ':lastUpdated': { S: now },
      },
      ReturnValues: 'ALL_NEW',
    }));
    if (!result.Attributes) {
      throw new Error('DynamoDB did not return the updated FMEA item.');
    }
    return jsonResponse(200, await formatFmeaEntry(readFmea(result.Attributes)));
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return jsonResponse(404, { message: 'FMEA item not found.' });
    }
    console.error('Failed to update FMEA entry in DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to update FMEA item.' });
  }
};

import { PutItemCommand } from '@aws-sdk/client-dynamodb';
import {
  createTeamId,
  dynamoDB,
  getTableName,
  jsonResponse,
  isProgram,
  isTeamNumber,
  parseRequestBody,
  teamItem,
  type HttpEvent,
} from './team-utils';

export const handler = async (event: HttpEvent) => {
  const request = parseRequestBody(event.body);
  if (
    !request ||
    !isProgram(request.program) ||
    !isTeamNumber(request.teamNumber) ||
    typeof request.name !== 'string' ||
    request.name.trim().length === 0
  ) {
    return jsonResponse(400, {
      message: 'Request body must include program ("frc" or "ftc"), a positive integer teamNumber, and a non-empty name.',
    });
  }

  const teamId = createTeamId();
  const name = request.name.trim();
  try {
    await dynamoDB.send(
      new PutItemCommand({
        TableName: getTableName(),
        Item: teamItem(teamId, request.program, request.teamNumber, name),
        ConditionExpression: 'attribute_not_exists(pk)',
      }),
    );
  } catch (error) {
    console.error('Failed to create team in DynamoDB.', error);
    return jsonResponse(500, { message: 'Unable to create team.' });
  }

  return jsonResponse(201, {
    id: teamId,
    program: request.program,
    teamNumber: request.teamNumber,
    name,
  });
};

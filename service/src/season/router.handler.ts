import { handler as createSeason } from './create-season.handler';
import { handler as deleteSeason } from './delete-season.handler';
import { handler as getSeason } from './get-season.handler';
import { handler as listSeasons } from './list-seasons.handler';
import { handler as updateSeason } from './update-season.handler';
import type { HttpEvent } from './season-utils';
import { emptyResponse, jsonResponse } from './season-utils';

type FunctionUrlEvent = HttpEvent & {
  rawPath?: string;
  isBase64Encoded?: boolean;
  requestContext?: {
    http?: {
      method?: string;
    };
  };
};

export const handler = async (event: FunctionUrlEvent) => {
  const method = event.requestContext?.http?.method?.toUpperCase();
  const rawPath = event.rawPath ?? '';
  const seasonPath = '/api/seasons';
  const seasonMatch = rawPath.match(/^\/api\/seasons\/([^/]+)$/);

  if (method === 'OPTIONS' && (rawPath === seasonPath || seasonMatch)) {
    return {
      ...emptyResponse(204),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    };
  }

  const routedEvent: HttpEvent = {
    body:
      event.isBase64Encoded && event.body
        ? Buffer.from(event.body, 'base64').toString('utf8')
        : event.body,
    queryStringParameters: event.queryStringParameters,
  };

  if (rawPath === seasonPath) {
    if (method === 'GET') return listSeasons(routedEvent);
    if (method === 'POST') return createSeason(routedEvent);
    return jsonResponse(405, { message: 'Method not allowed.' });
  }

  if (seasonMatch) {
    let seasonId: string;
    try {
      seasonId = decodeURIComponent(seasonMatch[1]);
    } catch {
      return jsonResponse(400, { message: 'Season ID is invalid.' });
    }
    routedEvent.pathParameters = { seasonId };

    if (method === 'GET') return getSeason(routedEvent);
    if (method === 'PATCH') return updateSeason(routedEvent);
    if (method === 'DELETE') return deleteSeason(routedEvent);
    return jsonResponse(405, { message: 'Method not allowed.' });
  }

  return jsonResponse(404, { message: 'Not found.' });
};

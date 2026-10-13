import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { getBearerToken, GoogleIdTokenError, verifyWorkspaceIdToken } from './auth/google-id-token.js';
import { prodConfig } from '../../cdk/lib/config.js';
import { handler as createActionItem } from './fmea/create-action-item.handler.js';
import { handler as createFmeaEntry } from './fmea/create-fmea-entry.handler.js';
import { handler as deleteFmeaEntry } from './fmea/delete-fmea-entry.handler.js';
import { handler as getFmeaEntry } from './fmea/get-fmea-entry.handler.js';
import { handler as listFmeaEntries } from './fmea/list-fmea-entries.handler.js';
import { handler as updateActionItem } from './fmea/update-action-item.handler.js';
import { handler as updateFmeaEntry } from './fmea/update-fmea-entry.handler.js';
import { handler as createSeason } from './season/create-season.handler.js';
import { handler as deleteSeason } from './season/delete-season.handler.js';
import { handler as getSeason } from './season/get-season.handler.js';
import { handler as listSeasons } from './season/list-seasons.handler.js';
import { handler as updateSeason } from './season/update-season.handler.js';
import { handler as createSubsystem } from './subsystem/create-subsystem.handler.js';
import { handler as listSubsystems } from './subsystem/list-subsystems.handler.js';
import { handler as createTeam } from './team/create-team.handler.js';
import { handler as deleteTeam } from './team/delete-team.handler.js';
import { handler as getTeam } from './team/get-team.handler.js';
import { handler as listTeams } from './team/list-teams.handler.js';
import { handler as updateTeam } from './team/update-team.handler.js';

type LambdaEvent = {
  body?: string | null;
  pathParameters?: Record<string, string | undefined> | null;
  queryStringParameters?: Record<string, string | undefined> | null;
  requestContext?: {
    authorizer?: {
      lambda?: {
        email?: string;
        name?: string;
      };
    };
  };
};

type LambdaResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
};

type ApiHandler = (event: LambdaEvent) => Promise<LambdaResponse>;

const routes: { method: string; path: string; handler: ApiHandler }[] = [
  { method: 'GET', path: '/api/seasons', handler: listSeasons },
  { method: 'POST', path: '/api/seasons', handler: createSeason },
  { method: 'GET', path: '/api/seasons/:seasonId', handler: getSeason },
  { method: 'PATCH', path: '/api/seasons/:seasonId', handler: updateSeason },
  { method: 'DELETE', path: '/api/seasons/:seasonId', handler: deleteSeason },
  { method: 'GET', path: '/api/teams', handler: listTeams },
  { method: 'POST', path: '/api/teams', handler: createTeam },
  { method: 'GET', path: '/api/teams/:teamId', handler: getTeam },
  { method: 'PATCH', path: '/api/teams/:teamId', handler: updateTeam },
  { method: 'DELETE', path: '/api/teams/:teamId', handler: deleteTeam },
  { method: 'GET', path: '/api/subsystems/:teamId', handler: listSubsystems },
  { method: 'POST', path: '/api/subsystems/:teamId', handler: createSubsystem },
  { method: 'GET', path: '/api/fmea/:teamId/:seasonId', handler: listFmeaEntries },
  { method: 'POST', path: '/api/fmea/new', handler: createFmeaEntry },
  { method: 'GET', path: '/api/fmea/:fmeaId', handler: getFmeaEntry },
  { method: 'PATCH', path: '/api/fmea/:fmeaId', handler: updateFmeaEntry },
  { method: 'DELETE', path: '/api/fmea/:fmeaId', handler: deleteFmeaEntry },
  { method: 'POST', path: '/api/fmea/:fmeaId/action-items', handler: createActionItem },
  { method: 'PATCH', path: '/api/action-item/:actionItemId', handler: updateActionItem },
];

const matchRoute = (method: string, pathname: string) => {
  const actualSegments = pathname.split('/').filter(Boolean);

  for (const route of routes) {
    if (route.method !== method) continue;
    const routeSegments = route.path.split('/').filter(Boolean);
    if (routeSegments.length !== actualSegments.length) continue;

    const pathParameters: Record<string, string> = {};
    const matches = routeSegments.every((segment, index) => {
      const actual = actualSegments[index];
      if (segment.startsWith(':')) {
        pathParameters[segment.slice(1)] = decodeURIComponent(actual);
        return true;
      }
      return segment === actual;
    });

    if (matches) return { ...route, pathParameters };
  }

  return undefined;
};

const readBody = async (request: IncomingMessage): Promise<string | null> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : null;
};

const sendJson = (response: ServerResponse, statusCode: number, body: unknown) => {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
};

const googleClientId = process.env.GOOGLE_CLIENT_ID ?? prodConfig.googleClientId;
const allowedDomain = process.env.ALLOWED_DOMAIN ?? prodConfig.allowedDomain;

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');
    if (request.method === 'GET' && requestUrl.pathname === '/config.json') {
      sendJson(response, 200, {
        googleClientId,
        allowedDomain,
      });
      return;
    }

    const route = matchRoute(request.method ?? 'GET', requestUrl.pathname);
    if (!route) {
      sendJson(response, 404, { message: 'Not found' });
      return;
    }

    const token = getBearerToken(request.headers.authorization);
    if (!token) {
      sendJson(response, 401, { message: 'Unauthorized' });
      return;
    }
    let principalContext: { email?: string; name?: string } = {};
    try {
      const payload = await verifyWorkspaceIdToken(token, {
        allowedDomain,
        clientId: googleClientId,
      });
      principalContext = {
        ...(payload.email ? { email: payload.email } : {}),
        ...(payload.name ? { name: payload.name } : {}),
      };
    } catch (error) {
      const statusCode = error instanceof GoogleIdTokenError
        ? error.reason === 'domain-not-allowed' ? 403 : error.reason === 'configuration' ? 500 : 401
        : 401;
      sendJson(response, statusCode, {
        message: statusCode === 403 ? 'Google Workspace account not allowed' : 'Unauthorized',
      });
      return;
    }

    const result = await route.handler({
      body: await readBody(request),
      pathParameters: route.pathParameters,
      queryStringParameters: Object.fromEntries(requestUrl.searchParams.entries()),
      requestContext: { authorizer: { lambda: principalContext } },
    });

    response.statusCode = result.statusCode;
    for (const [name, value] of Object.entries(result.headers ?? {})) {
      response.setHeader(name, value);
    }
    response.end(result.body ?? '');
  } catch (error) {
    console.error('Local API request failed:', error);
    sendJson(response, 500, { message: 'Internal server error' });
  }
});

const tableName = process.env.TABLE_NAME;
if (!tableName || !googleClientId || !allowedDomain) {
  console.error('Set TABLE_NAME in service/.env and configure Google auth in cdk/lib/config.ts.');
  process.exitCode = 1;
} else {
  const port = Number(process.env.API_PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('API_PORT must be a valid port number.');
    process.exitCode = 1;
  } else {
    const host = process.env.API_HOST ?? '127.0.0.1';
    server.listen(port, host, () => {
      console.info(`Local API listening at http://${host}:${port} (table: ${tableName})`);
    });
  }
}
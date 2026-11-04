import { readServerSession } from './server-session.js';

export type HttpApiAuthorizerEvent = {
  headers?: Record<string, string | string[] | undefined>;
  methodArn: string;
  requestContext?: {
    requestId?: string;
  };
};

export type AuthorizerPolicy = {
  principalId: string;
  context?: {
    email?: string;
    name?: string;
  };
  policyDocument: {
    Version: '2012-10-17';
    Statement: [{
      Action: 'execute-api:Invoke';
      Effect: 'Allow' | 'Deny';
      Resource: string;
    }];
  };
};

export const createPolicy = (
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context?: AuthorizerPolicy['context'],
): AuthorizerPolicy => ({
  principalId,
  ...(context ? { context } : {}),
  policyDocument: {
    Version: '2012-10-17',
    Statement: [{ Action: 'execute-api:Invoke', Effect: effect, Resource: resource }],
  },
});

export const authorizeRequest = async (
  event: HttpApiAuthorizerEvent,
  readSession = readServerSession,
): Promise<AuthorizerPolicy> => {
  const logContext = {
    ...(event.requestContext?.requestId ? { requestId: event.requestContext.requestId } : {}),
    methodArn: event.methodArn,
  };
  const headers = event.headers ?? {};
  const sessionCookieName = process.env.AWS_LAMBDA_FUNCTION_NAME
    ? '__Host-fmea-session'
    : 'fmea-local-session';
  const cookieHeader = Array.isArray(headers.cookie) ? headers.cookie.join(';') : headers.cookie;
  if (!cookieHeader?.split(';').some(part => part.trim().startsWith(`${sessionCookieName}=`))) {
    console.warn(JSON.stringify({ event: 'authorization_denied', reason: 'missing_session_cookie', ...logContext }));
    return createPolicy('unauthenticated', 'Deny', event.methodArn);
  }

  try {
    const session = await readSession(headers);
    return createPolicy(
      session.sub,
      'Allow',
      event.methodArn,
      { email: session.email, name: session.name },
    );
  } catch {
    console.warn(JSON.stringify({ event: 'authorization_denied', reason: 'invalid_server_session', ...logContext }));
    return createPolicy('unauthorized', 'Deny', event.methodArn);
  }
};

export const handler = (event: HttpApiAuthorizerEvent): Promise<AuthorizerPolicy> =>
  authorizeRequest(event);
import {
  getBearerToken,
  GoogleIdTokenError,
  verifyWorkspaceIdToken,
} from './google-id-token.js';

export type HttpApiAuthorizerEvent = {
  headers?: Record<string, string | undefined>;
  routeArn: string;
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
  verify = verifyWorkspaceIdToken,
): Promise<AuthorizerPolicy> => {
  const authorization = event.headers?.authorization ?? event.headers?.Authorization;
  const token = getBearerToken(authorization);
  if (!token) {
    const reason = authorization ? 'malformed_bearer_token' : 'missing_bearer_token';
    console.warn(JSON.stringify({ event: 'authorization_denied', reason }));
    return createPolicy('unauthenticated', 'Deny', event.routeArn);
  }

  try {
    const payload = await verify(token, {
      allowedDomain: process.env.ALLOWED_DOMAIN,
      clientId: process.env.GOOGLE_CLIENT_ID,
    });
    const context = {
      ...(payload.email ? { email: payload.email } : {}),
      ...(payload.name ? { name: payload.name } : {}),
    };
    return createPolicy(
      payload.sub,
      'Allow',
      event.routeArn,
      Object.keys(context).length > 0 ? context : undefined,
    );
  } catch (error) {
    const reason = error instanceof GoogleIdTokenError ? error.reason : 'verification_failed';
    console.warn(JSON.stringify({ event: 'authorization_denied', reason }));
    return createPolicy('unauthorized', 'Deny', event.routeArn);
  }
};

export const handler = (event: HttpApiAuthorizerEvent): Promise<AuthorizerPolicy> =>
  authorizeRequest(event);
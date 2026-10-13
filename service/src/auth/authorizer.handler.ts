import {
  getBearerToken,
  GoogleIdTokenError,
  verifyWorkspaceIdToken,
} from './google-id-token.js';

export type HttpApiAuthorizerEvent = {
  headers?: Record<string, string | undefined>;
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
  verify = verifyWorkspaceIdToken,
): Promise<AuthorizerPolicy> => {
  const logContext = {
    ...(event.requestContext?.requestId ? { requestId: event.requestContext.requestId } : {}),
    methodArn: event.methodArn,
  };
  const authorization = event.headers?.authorization ?? event.headers?.Authorization;
  const token = getBearerToken(authorization);
  if (!token) {
    const reason = authorization ? 'malformed_bearer_token' : 'missing_bearer_token';
    console.warn(JSON.stringify({ event: 'authorization_denied', reason, ...logContext }));
    return createPolicy('unauthenticated', 'Deny', event.methodArn);
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
      event.methodArn,
      Object.keys(context).length > 0 ? context : undefined,
    );
  } catch (error) {
    const reason = error instanceof GoogleIdTokenError ? error.reason : 'verification_failed';
    console.warn(JSON.stringify({ event: 'authorization_denied', reason, ...logContext }));
    return createPolicy('unauthorized', 'Deny', event.methodArn);
  }
};

export const handler = (event: HttpApiAuthorizerEvent): Promise<AuthorizerPolicy> =>
  authorizeRequest(event);
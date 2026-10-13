import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TokenPayload } from 'google-auth-library';
import { authorizeRequest, createPolicy } from './authorizer.handler.js';
import { verifyWorkspaceIdToken } from './google-id-token.js';

const routeArn = 'arn:aws:execute-api:us-east-2:123456789012:api-id/prod/GET/api/teams';

test('creates an IAM policy with the requested principal, effect, and route', () => {
  assert.deepEqual(createPolicy('google-sub', 'Allow', routeArn), {
    principalId: 'google-sub',
    policyDocument: {
      Version: '2012-10-17',
      Statement: [{ Action: 'execute-api:Invoke', Effect: 'Allow', Resource: routeArn }],
    },
  });
});

test('allows the verified Google sub for the current route', async () => {
  const previousClientId = process.env.GOOGLE_CLIENT_ID;
  const previousDomain = process.env.ALLOWED_DOMAIN;
  process.env.GOOGLE_CLIENT_ID = 'client-id';
  process.env.ALLOWED_DOMAIN = 'example.org';
  const verify = async (token: string, options: Parameters<typeof verifyWorkspaceIdToken>[1]) => {
    assert.equal(token, 'id-token');
    assert.deepEqual(options, { allowedDomain: 'example.org', clientId: 'client-id' });
    return {
      sub: 'google-sub',
      email: 'person@example.org',
      name: 'Example Person',
    } as TokenPayload;
  };

  try {
    const policy = await authorizeRequest({
      headers: { Authorization: 'Bearer id-token' },
      routeArn,
    }, verify);

    assert.equal(policy.principalId, 'google-sub');
    assert.deepEqual(policy.context, {
      email: 'person@example.org',
      name: 'Example Person',
    });
    assert.equal(policy.policyDocument.Statement[0].Effect, 'Allow');
    assert.equal(policy.policyDocument.Statement[0].Resource, routeArn);
  } finally {
    if (previousClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = previousClientId;
    if (previousDomain === undefined) delete process.env.ALLOWED_DOMAIN;
    else process.env.ALLOWED_DOMAIN = previousDomain;
  }
});

test('denies a missing token and a failed Workspace verification', async () => {
  const event = { headers: {}, routeArn };
  const missingToken = await authorizeRequest(event);
  assert.equal(missingToken.policyDocument.Statement[0].Effect, 'Deny');
  assert.equal(missingToken.policyDocument.Statement[0].Resource, routeArn);

  const invalidToken = await authorizeRequest({
    headers: { authorization: 'Bearer invalid' },
    routeArn,
  }, async () => { throw new Error('verification failed'); });
  assert.equal(invalidToken.principalId, 'unauthorized');
  assert.equal(invalidToken.policyDocument.Statement[0].Effect, 'Deny');
});
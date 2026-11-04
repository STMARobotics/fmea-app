import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authorizeRequest, createPolicy } from './authorizer.handler.js';

const methodArn = 'arn:aws:execute-api:us-east-2:123456789012:api-id/prod/GET/api/teams';
const cookieName = process.env.AWS_LAMBDA_FUNCTION_NAME ? '__Host-fmea-session' : 'fmea-local-session';

test('creates an IAM policy with the requested principal, effect, and route', () => {
  assert.deepEqual(createPolicy('google-sub', 'Allow', methodArn), {
    principalId: 'google-sub',
    policyDocument: {
      Version: '2012-10-17',
      Statement: [{ Action: 'execute-api:Invoke', Effect: 'Allow', Resource: methodArn }],
    },
  });
});

test('allows an active server-side session and supplies verified account context', async () => {
  const policy = await authorizeRequest({
    headers: { cookie: `${cookieName}=opaque-session` },
    methodArn,
  }, async headers => {
    assert.equal(headers.cookie, `${cookieName}=opaque-session`);
    return {
      sub: 'google-sub',
      email: 'person@example.org',
      name: 'Example Person',
      picture: '',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
  });

  assert.equal(policy.principalId, 'google-sub');
  assert.deepEqual(policy.context, {
    googleSub: 'google-sub',
    email: 'person@example.org',
    name: 'Example Person',
  });
  assert.equal(policy.policyDocument.Statement[0].Effect, 'Allow');
  assert.equal(policy.policyDocument.Statement[0].Resource, methodArn);
});

test('denies a missing cookie and a revoked or expired session', async () => {
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (message?: unknown) => warnings.push(String(message));
  const requestContext = { requestId: 'gateway-denial-id' };
  try {
    const missing = await authorizeRequest({ headers: {}, methodArn, requestContext });
    const invalid = await authorizeRequest({
      headers: { cookie: `${cookieName}=expired-session` },
      methodArn,
      requestContext,
    }, async () => { throw new Error('expired'); });
    const bearerOnly = await authorizeRequest({
      headers: { Authorization: '******' },
      methodArn,
      requestContext,
    });
    assert.equal(missing.policyDocument.Statement[0].Effect, 'Deny');
    assert.equal(missing.policyDocument.Statement[0].Resource, methodArn);
    assert.equal(invalid.policyDocument.Statement[0].Effect, 'Deny');
    assert.equal(invalid.principalId, 'unauthorized');
    assert.equal(invalid.policyDocument.Statement[0].Resource, methodArn);
    assert.equal(bearerOnly.policyDocument.Statement[0].Effect, 'Deny');
  } finally {
    console.warn = originalWarn;
  }
  assert.deepEqual(warnings.map(message => JSON.parse(message).reason), [
    'missing_session_cookie',
    'invalid_server_session',
    'missing_session_cookie',
  ]);
  assert.ok(warnings.every(message => JSON.parse(message).requestId === 'gateway-denial-id'));
  assert.equal(warnings.join(' ').includes('a-valid-google-token'), false);
});

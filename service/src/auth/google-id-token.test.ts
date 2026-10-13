import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TokenPayload } from 'google-auth-library';
import {
  getBearerToken,
  GoogleIdTokenError,
  verifyWorkspaceIdToken,
  type GoogleIdTokenVerifier,
} from './google-id-token.js';

const workspacePayload = { sub: 'google-user-123', hd: 'example.org' } as TokenPayload;

const verifierFor = (
  payload: TokenPayload | undefined,
  verifyIdToken: GoogleIdTokenVerifier['verifyIdToken'] = async () => ({
    getPayload: () => payload,
  }),
): GoogleIdTokenVerifier => ({ verifyIdToken });

const options = (verifier = verifierFor(workspacePayload)) => ({
  allowedDomain: 'example.org',
  clientId: 'web-client-id',
  verifier,
});

test('extracts a Bearer token case-insensitively', () => {
  assert.equal(getBearerToken('  bEaReR abc.def  '), 'abc.def');
  assert.equal(getBearerToken('Basic abc'), null);
  assert.equal(getBearerToken('Bearer'), null);
  assert.equal(getBearerToken(undefined), null);
});

test('verifies ID token audience and returns a Workspace principal payload', async () => {
  let received: { idToken: string; audience: string } | undefined;
  const verifier = verifierFor(workspacePayload, async (request) => {
    received = request;
    return { getPayload: () => workspacePayload };
  });

  const payload = await verifyWorkspaceIdToken('signed-token', options(verifier));

  assert.deepEqual(received, { idToken: 'signed-token', audience: 'web-client-id' });
  assert.equal(payload.sub, 'google-user-123');
});

test('rejects a token from a different or missing hosted domain', async () => {
  await assert.rejects(
    verifyWorkspaceIdToken('token', options(verifierFor({ ...workspacePayload, hd: 'other.org' }))),
    (error: unknown) => error instanceof GoogleIdTokenError && error.reason === 'domain-not-allowed',
  );
  await assert.rejects(
    verifyWorkspaceIdToken('token', options(verifierFor({ sub: 'google-user-123' } as TokenPayload))),
    (error: unknown) => error instanceof GoogleIdTokenError && error.reason === 'domain-not-allowed',
  );
});

test('rejects missing configuration, missing subject, and invalid signatures', async () => {
  await assert.rejects(
    verifyWorkspaceIdToken('token', { allowedDomain: undefined, clientId: 'web-client-id' }),
    (error: unknown) => error instanceof GoogleIdTokenError && error.reason === 'configuration',
  );
  await assert.rejects(
    verifyWorkspaceIdToken('token', options(verifierFor(undefined))),
    (error: unknown) => error instanceof GoogleIdTokenError && error.reason === 'invalid-token',
  );
  await assert.rejects(
    verifyWorkspaceIdToken('token', options(verifierFor(undefined, async () => { throw new Error('invalid signature'); }))),
    (error: unknown) => error instanceof GoogleIdTokenError && error.reason === 'invalid-token',
  );
});
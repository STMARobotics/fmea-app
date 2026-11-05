import {
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { GoogleIdTokenError, verifyWorkspaceIdToken } from './google-id-token.js';
import { dynamoDB } from '../fmea/fmea-utils.js';

const SESSION_SECONDS = 7 * 24 * 60 * 60;
const OAUTH_SECONDS = 10 * 60;
const local = () => !process.env.AWS_LAMBDA_FUNCTION_NAME;
const sessionCookie = () => local() ? 'fmea-local-session' : '__Host-fmea-session';
const stateCookie = () => local() ? 'fmea-local-oauth-state' : '__Host-fmea-oauth-state';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
let secretCache: string | undefined;
const ssm = new SSMClient({});

type Headers = Record<string, string | string[] | undefined>;
type Session = { sub: string; email: string; name: string; picture: string; expiresAt: string };
class SessionFailure extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const tableName = () => {
  const name = process.env.TABLE_NAME;
  if (!name) throw new Error('TABLE_NAME is not configured.');
  return name;
};
const cookieValue = (headers: Headers, name: string) => {
  const raw = headers.cookie;
  const value = Array.isArray(raw) ? raw.join(';') : raw;
  return value
  ?.split(';').map(part => part.trim())
  .find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
};
const cookie = (name: string, value: string, age: number) =>
  `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${local() ? '' : '; Secure'}`;
const response = (statusCode: number, body: unknown, headers: Record<string, string> = {}, cookies: string[] = []) => ({
  statusCode,
  headers: { 'cache-control': 'private, no-store', vary: 'Cookie', ...headers },
  ...(cookies.length ? { cookies } : {}),
  body: JSON.stringify(body),
});
const redirect = (location: string, cookies: string[] = []) => ({
  statusCode: 303,
  headers: { location, 'cache-control': 'private, no-store', vary: 'Cookie' },
  cookies,
  body: '',
});
async function getClientSecret() {
  if (local()) {
    if (process.env.GOOGLE_CLIENT_SECRET) return process.env.GOOGLE_CLIENT_SECRET;
    throw new Error('GOOGLE_CLIENT_SECRET is required for local OAuth.');
  }
  if (secretCache) return secretCache;
  const parameter = process.env.GOOGLE_CLIENT_SECRET_PARAMETER;
  if (!parameter) throw new Error('GOOGLE_CLIENT_SECRET_PARAMETER is not configured.');
  const result = await ssm.send(new GetParameterCommand({ Name: parameter, WithDecryption: true }));
  if (!result.Parameter?.Value) throw new Error('Google OAuth client secret is unavailable.');
  secretCache = result.Parameter.Value;
  return result.Parameter.Value;
}

export async function readServerSession(headers: Headers): Promise<Session> {
  const token = cookieValue(headers, sessionCookie());
  if (!token) throw new Error('Session cookie is missing.');
  const result = await dynamoDB.send(new GetItemCommand({
    TableName: tableName(),
    Key: { pk: { S: `FMEA_SESSION#${hash(token)}` }, sk: { S: 'METADATA' } },
    ConsistentRead: true,
  }));
  const item = result.Item;
  const session: Session | undefined = item?.sub?.S && item.email?.S && item.expiresAt?.S
    ? {
      sub: item.sub.S,
      email: item.email.S,
      name: item.name?.S ?? item.email.S,
      picture: item.picture?.S ?? '',
      expiresAt: item.expiresAt.S,
    }
    : undefined;
  if (!session || session.expiresAt <= new Date().toISOString()) throw new Error('Session is expired.');
  return session;
}

export async function beginServerOAuth() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const origin = process.env.ALLOWED_ORIGIN;
  if (!clientId || !origin) throw new Error('Google OAuth configuration is incomplete.');
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const nonce = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + OAUTH_SECONDS * 1000).toISOString();
  await dynamoDB.send(new PutItemCommand({
    TableName: tableName(),
    Item: {
      pk: { S: `FMEA_OAUTH#${hash(state)}` },
      sk: { S: 'METADATA' },
      verifier: { S: verifier },
      nonce: { S: nonce },
      expiresAt: { S: expiresAt },
      ttl: { N: String(Math.floor(Date.now() / 1000) + OAUTH_SECONDS) },
    },
  }));
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    hd: process.env.ALLOWED_DOMAIN ?? 'stmarobotics.org',
  }).toString();
  return redirect(url.toString(), [cookie(stateCookie(), state, OAUTH_SECONDS)]);
}

export async function finishServerOAuth(event: any) {
  const state = event.queryStringParameters?.state as string | undefined;
  const fromCookie = cookieValue(event.headers ?? {}, stateCookie());
  const clearState = cookie(stateCookie(), '', 0);
  let failureStage = 'validate_state';
  try {
    if (!state || !fromCookie || Buffer.byteLength(state) !== Buffer.byteLength(fromCookie) ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(fromCookie))) {
      throw new SessionFailure(401, 'OAuth state is invalid.');
    }
    failureStage = 'consume_oauth_state';
    let pending;
    try {
      pending = await dynamoDB.send(new UpdateItemCommand({
        TableName: tableName(),
        Key: { pk: { S: `FMEA_OAUTH#${hash(state)}` }, sk: { S: 'METADATA' } },
        UpdateExpression: 'SET #consumed = :yes',
        ConditionExpression: 'attribute_exists(pk) AND expiresAt > :now AND attribute_not_exists(#consumed)',
        ExpressionAttributeNames: { '#consumed': 'consumed' },
        ExpressionAttributeValues: { ':yes': { BOOL: true }, ':now': { S: new Date().toISOString() } },
        ReturnValues: 'ALL_OLD',
      }));
    } catch (error) {
      if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
        throw new SessionFailure(401, 'OAuth state expired or already used.');
      }
      throw error;
    }
    const pendingItem = pending.Attributes;
    const code = event.queryStringParameters?.code as string | undefined;
    if (!pendingItem?.verifier?.S || !pendingItem.nonce?.S || !code) {
      throw new SessionFailure(401, 'OAuth state or authorization code is missing.');
    }
    failureStage = 'exchange_google_token';
    const origin = process.env.ALLOWED_ORIGIN!;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: await getClientSecret(),
        redirect_uri: `${origin}/api/auth/callback`,
        grant_type: 'authorization_code',
        code_verifier: pendingItem.verifier.S,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!tokenResponse.ok) throw new SessionFailure(401, 'Google token exchange failed.');
    const tokens = await tokenResponse.json() as { id_token?: string };
    if (!tokens.id_token) throw new SessionFailure(401, 'Google did not return an ID token.');
    failureStage = 'verify_google_identity';
    const payload = await verifyWorkspaceIdToken(tokens.id_token, {
      allowedDomain: process.env.ALLOWED_DOMAIN,
      clientId: process.env.GOOGLE_CLIENT_ID,
    });
    if (payload.email_verified !== true || !payload.email ||
      !payload.nonce || Buffer.byteLength(payload.nonce) !== Buffer.byteLength(pendingItem.nonce.S) ||
      !timingSafeEqual(Buffer.from(payload.nonce), Buffer.from(pendingItem.nonce.S))) {
      throw new SessionFailure(401, 'Google identity claims could not be verified.');
    }
    failureStage = 'save_session';
    const token = randomBytes(32).toString('base64url');
    const expires = new Date(Date.now() + SESSION_SECONDS * 1000);
    await dynamoDB.send(new PutItemCommand({
      TableName: tableName(),
      Item: {
        pk: { S: `FMEA_SESSION#${hash(token)}` }, sk: { S: 'METADATA' },
        sub: { S: payload.sub }, email: { S: payload.email },
        name: { S: payload.name ?? payload.email }, picture: { S: payload.picture ?? '' },
        expiresAt: { S: expires.toISOString() }, ttl: { N: String(Math.floor(expires.getTime() / 1000)) },
      },
    }));
    return redirect('/', [clearState, cookie(sessionCookie(), token, SESSION_SECONDS)]);
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'oauth.callback.failure',
      errorType: error instanceof Error ? error.name : 'unknown',
      stage: failureStage,
      ...(local() && error instanceof Error && error.name === 'ValidationException'
        ? { errorMessage: error.message }
        : {}),
    }));
    const status = error instanceof SessionFailure
      ? error.status
      : error instanceof GoogleIdTokenError ? 401 : 503;
    return response(status, {
      message: status === 401
        ? 'Google sign-in expired or could not be verified. Please try again.'
        : 'Google sign-in is temporarily unavailable. Please try again.',
    }, { 'content-type': 'application/json' }, [clearState]);
  }
}

export async function endServerSession(headers: Headers) {
  const token = cookieValue(headers, sessionCookie());
  if (token) await dynamoDB.send(new DeleteItemCommand({
    TableName: tableName(),
    Key: { pk: { S: `FMEA_SESSION#${hash(token)}` }, sk: { S: 'METADATA' } },
  }));
  return response(200, { signedOut: true }, { 'content-type': 'application/json' }, [
    cookie(sessionCookie(), '', 0),
    cookie(stateCookie(), '', 0),
  ]);
}

export const serverSessionHandler = async (event: any) => {
  const path = event.rawPath ?? '';
  try {
    if (path === '/api/auth/start') return await beginServerOAuth();
    if (path === '/api/auth/callback') return await finishServerOAuth(event);
    if (path === '/api/auth/logout') return await endServerSession(event.headers ?? {});
    if (path === '/api/auth/session') {
      try {
        const session = await readServerSession(event.headers ?? {});
        return response(200, { sub: session.sub, email: session.email, name: session.name, picture: session.picture }, { 'content-type': 'application/json' });
      } catch {
        return response(401, { message: 'Sign in with your Google Workspace account.' }, { 'content-type': 'application/json' });
      }
    }
    return response(404, { message: 'Not found' });
  } catch (error) {
    console.error('Server session request failed.', error);
    return response(503, { message: 'Authentication is temporarily unavailable.' }, { 'content-type': 'application/json' });
  }
};

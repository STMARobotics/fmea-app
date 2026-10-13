import { OAuth2Client, type TokenPayload } from 'google-auth-library';

export type GoogleIdTokenVerifier = {
  verifyIdToken: (options: { idToken: string; audience: string }) => Promise<{
    getPayload: () => TokenPayload | undefined;
  }>;
};

export class GoogleIdTokenError extends Error {
  constructor(readonly reason: 'configuration' | 'invalid-token' | 'domain-not-allowed') {
    super(reason);
    this.name = 'GoogleIdTokenError';
  }
}

export const getBearerToken = (authorization: string | undefined): string | null => {
  const match = authorization?.trim().match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
};

export const verifyWorkspaceIdToken = async (
  idToken: string,
  options: {
    allowedDomain: string | undefined;
    clientId: string | undefined;
    verifier?: GoogleIdTokenVerifier;
  },
): Promise<TokenPayload> => {
  const { allowedDomain, clientId } = options;
  if (!allowedDomain || !clientId) {
    throw new GoogleIdTokenError('configuration');
  }
  if (!idToken) {
    throw new GoogleIdTokenError('invalid-token');
  }

  let payload: TokenPayload | undefined;
  try {
    const verifier = options.verifier ?? new OAuth2Client(clientId);
    const ticket = await verifier.verifyIdToken({ idToken, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    throw new GoogleIdTokenError('invalid-token');
  }

  if (!payload?.sub) {
    throw new GoogleIdTokenError('invalid-token');
  }
  if (payload.hd !== allowedDomain) {
    throw new GoogleIdTokenError('domain-not-allowed');
  }
  return payload;
};
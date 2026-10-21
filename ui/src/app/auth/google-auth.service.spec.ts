import { TestBed } from '@angular/core/testing';
import { GoogleAuthService } from './google-auth.service';

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  let credentialCallback: ((response: { credential: string }) => void) | undefined;
  let identity: NonNullable<Window['google']>;

  const createCredential = (claims: Record<string, string | number>): string => {
    const encoded = btoa(JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...claims,
    })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `header.${encoded}.signature`;
  };

  beforeEach(() => {
    credentialCallback = undefined;
    sessionStorage.removeItem('fmea.googleIdToken');
    identity = {
      accounts: {
        id: {
          initialize: vi.fn(options => { credentialCallback = options.callback; }),
          renderButton: vi.fn(),
          disableAutoSelect: vi.fn(),
        },
      },
    };
    window.google = identity;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ googleClientId: 'client-id', allowedDomain: 'example.org' }),
    }));
    TestBed.configureTestingModule({ providers: [GoogleAuthService] });
    service = TestBed.inject(GoogleAuthService);
  });

  afterEach(() => {
    delete window.google;
    sessionStorage.removeItem('fmea.googleIdToken');
    vi.unstubAllGlobals();
  });

  it('loads runtime settings and renders Google sign-in', async () => {
    const button = document.createElement('div');
    await service.renderSignInButton(button);

    expect(fetch).toHaveBeenCalledWith('/config.json');
    expect(identity.accounts.id.initialize).toHaveBeenCalledWith(expect.objectContaining({
      client_id: 'client-id',
      auto_select: false,
    }));
    expect(identity.accounts.id.renderButton).toHaveBeenCalledWith(button, expect.objectContaining({
      text: 'signin_with',
      size: 'large',
    }));
  });

  it('stores an ID token and account only for the configured Workspace domain', async () => {
    await service.renderSignInButton(document.createElement('div'));
    const token = createCredential({
      sub: 'google-sub',
      hd: 'example.org',
      email: 'member@example.org',
      name: 'Workspace Member',
      picture: 'https://example.org/avatar.png',
    });
    credentialCallback?.({ credential: token });

    expect(service.token).toBe(token);
    expect(service.user()).toEqual({
      sub: 'google-sub',
      email: 'member@example.org',
      name: 'Workspace Member',
      picture: 'https://example.org/avatar.png',
    });
    expect(service.isAuthenticated()).toBe(true);
    expect(sessionStorage.getItem('fmea.googleIdToken')).toBe(token);
  });

  it('restores a valid signed-in session after a page refresh', async () => {
    await service.renderSignInButton(document.createElement('div'));
    const token = createCredential({
      sub: 'google-sub',
      hd: 'example.org',
      email: 'member@example.org',
      name: 'Workspace Member',
    });
    credentialCallback?.({ credential: token });

    const refreshedService = new GoogleAuthService();
    await refreshedService.renderSignInButton(document.createElement('div'));

    expect(refreshedService.token).toBe(token);
    expect(refreshedService.user()).toEqual({
      sub: 'google-sub',
      email: 'member@example.org',
      name: 'Workspace Member',
      picture: '',
    });
    expect(refreshedService.isAuthenticated()).toBe(true);
  });

  it('discards an expired saved session', async () => {
    sessionStorage.setItem('fmea.googleIdToken', createCredential({
      sub: 'google-sub',
      hd: 'example.org',
      exp: Math.floor(Date.now() / 1000) - 1,
    }));

    await service.renderSignInButton(document.createElement('div'));

    expect(service.token).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem('fmea.googleIdToken')).toBeNull();
  });

  it('denies missing and outside-domain hosted-domain claims', async () => {
    await service.renderSignInButton(document.createElement('div'));
    credentialCallback?.({ credential: createCredential({ sub: 'personal', hd: 'gmail.com' }) });

    expect(service.accessDenied()).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.token).toBeNull();
    expect(service.user()).toBeNull();

    credentialCallback?.({ credential: createCredential({ sub: 'no-domain' }) });
    expect(service.accessDenied()).toBe(true);
  });

  it('reports malformed ID tokens as sign-in errors', async () => {
    await service.renderSignInButton(document.createElement('div'));
    credentialCallback?.({ credential: 'not-a-jwt' });

    expect(service.signInError()).toBe(true);
    expect(service.user()).toBeNull();
    expect(service.token).toBeNull();
  });

  it('signs out and disables automatic account selection', async () => {
    await service.renderSignInButton(document.createElement('div'));
    credentialCallback?.({ credential: createCredential({ sub: 'member', hd: 'example.org' }) });
    service.signOut();

    expect(service.user()).toBeNull();
    expect(service.token).toBeNull();
    expect(service.accessDenied()).toBe(false);
    expect(identity.accounts.id.disableAutoSelect).toHaveBeenCalledOnce();
  });

  it('clears an expired session and gates forbidden responses', async () => {
    await service.renderSignInButton(document.createElement('div'));
    credentialCallback?.({ credential: createCredential({ sub: 'member', hd: 'example.org' }) });
    service.handleAuthorizationFailure(403);
    expect(service.accessDenied()).toBe(true);
    expect(service.token).toBeNull();
    expect(service.isAuthenticated()).toBe(false);

    service.handleAuthorizationFailure(401);
    expect(service.accessDenied()).toBe(false);
    expect(service.user()).toBeNull();
  });

  it('shows a configuration error when runtime settings are unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await service.renderSignInButton(document.createElement('div'));

    expect(service.configurationError()).toBe(true);
    expect(identity.accounts.id.renderButton).not.toHaveBeenCalled();
  });

  it('shows a configuration error when GIS fails to load', async () => {
    delete window.google;
    const appendScript = vi.spyOn(document.head, 'appendChild').mockImplementation(node => {
      const script = node as HTMLScriptElement;
      script.dispatchEvent(new Event('error'));
      return node;
    });

    await service.renderSignInButton(document.createElement('div'));

    expect(appendScript).toHaveBeenCalledOnce();
    expect(service.configurationError()).toBe(true);
  });
});
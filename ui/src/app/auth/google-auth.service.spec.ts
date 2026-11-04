import { TestBed } from '@angular/core/testing';
import { GoogleAuthService } from './google-auth.service';

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [GoogleAuthService] });
    service = TestBed.inject(GoogleAuthService);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('restores the account from the server-managed session after refresh', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        sub: 'google-sub',
        email: 'member@example.org',
        name: 'Workspace Member',
        picture: 'https://example.org/avatar.png',
      }),
    }));

    await service.restoreSession();

    expect(fetch).toHaveBeenCalledWith('/api/auth/session', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    expect(service.user()).toEqual({
      sub: 'google-sub',
      email: 'member@example.org',
      name: 'Workspace Member',
      picture: 'https://example.org/avatar.png',
    });
    expect(service.isAuthenticated()).toBe(true);
  });

  it('does not report an error when there is no session cookie', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await service.restoreSession();
    expect(service.user()).toBeNull();
    expect(service.configurationError()).toBe(false);
  });

  it('clears local state and revokes the server session on sign out', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    service.user.set({
      sub: 'google-sub',
      email: 'member@example.org',
      name: 'Workspace Member',
      picture: '',
    });
    service.signOut();
    expect(service.user()).toBeNull();
    expect(fetch).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
    });
  });

  it('clears the session and gates forbidden responses', () => {
    service.user.set({
      sub: 'google-sub',
      email: 'member@example.org',
      name: 'Workspace Member',
      picture: '',
    });
    service.handleAuthorizationFailure(403);
    expect(service.accessDenied()).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
  });

  it('reports an unavailable auth service', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await service.restoreSession();
    expect(service.configurationError()).toBe(true);
  });
});

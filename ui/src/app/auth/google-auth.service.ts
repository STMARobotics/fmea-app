import { computed, Injectable, signal } from '@angular/core';

type SessionResponse = {
  sub: string;
  email: string;
  name: string;
  picture: string;
};

export type GoogleAccount = SessionResponse;

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  readonly user = signal<GoogleAccount | null>(null);
  readonly accessDenied = signal(false);
  readonly configurationError = signal(false);
  readonly signInError = signal(false);
  readonly isAuthenticated = computed(() => this.user() !== null && !this.accessDenied());

  async restoreSession(): Promise<void> {
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (response.status === 401) {
        this.user.set(null);
        this.accessDenied.set(false);
        return;
      }
      if (response.status === 403) {
        this.accessDenied.set(true);
        return;
      }
      if (!response.ok) throw new Error('Authentication service is unavailable.');
      const session: unknown = await response.json();
      if (
        session === null || typeof session !== 'object' ||
        !('sub' in session) || typeof session.sub !== 'string' ||
        !('email' in session) || typeof session.email !== 'string'
      ) {
        throw new Error('Authentication service returned an invalid session.');
      }
      const user = session as SessionResponse;
      this.user.set({
        sub: user.sub,
        email: user.email,
        name: typeof user.name === 'string' ? user.name : user.email,
        picture: typeof user.picture === 'string' ? user.picture : '',
      });
      this.configurationError.set(false);
      this.signInError.set(false);
      this.accessDenied.set(false);
    } catch {
      this.configurationError.set(true);
    }
  }

  signIn(): void {
    window.location.assign('/api/auth/start');
  }

  signOut(): void {
    this.user.set(null);
    this.accessDenied.set(false);
    this.signInError.set(false);
    void fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
    }).catch(() => this.signInError.set(true));
  }

  handleAuthorizationFailure(status: number): void {
    if (status === 401) {
      this.signOut();
    } else if (status === 403) {
      this.user.set(null);
      this.accessDenied.set(true);
    }
  }
}

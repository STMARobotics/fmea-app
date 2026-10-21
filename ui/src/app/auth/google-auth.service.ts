import { computed, Injectable, signal } from '@angular/core';

type GoogleCredentialResponse = { credential: string };
type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        auto_select: false;
        callback: (response: GoogleCredentialResponse) => void;
      }) => void;
      renderButton: (element: HTMLElement, options: Record<string, string | number>) => void;
      disableAutoSelect: () => void;
    };
  };
};

type GoogleClaims = {
  sub?: string;
  hd?: string;
  email?: string;
  name?: string;
  picture?: string;
  exp?: number;
};

export type GoogleAccount = {
  sub: string;
  email: string;
  name: string;
  picture: string;
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private static readonly SESSION_TOKEN_KEY = 'fmea.googleIdToken';

  readonly user = signal<GoogleAccount | null>(null);
  readonly accessDenied = signal(false);
  readonly configurationError = signal(false);
  readonly signInError = signal(false);
  readonly isAuthenticated = computed(() => this.user() !== null && !this.accessDenied());

  private idToken: string | null = null;
  private googleIdentityPromise: Promise<GoogleIdentity> | null = null;
  private allowedDomain = '';

  get token(): string | null {
    return this.idToken;
  }

  async renderSignInButton(element: HTMLElement): Promise<void> {
    try {
      const google = await this.loadGoogleIdentity();
      google.accounts.id.renderButton(element, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
      });
    } catch {
      this.configurationError.set(true);
    }
  }

  signOut(): void {
    this.clearSession();
    this.user.set(null);
    this.accessDenied.set(false);
    this.signInError.set(false);
    window.google?.accounts.id.disableAutoSelect();
  }

  handleAuthorizationFailure(status: number): void {
    if (status === 401) {
      this.signOut();
    } else if (status === 403) {
      this.clearSession();
      this.accessDenied.set(true);
    }
  }

  private loadGoogleIdentity(): Promise<GoogleIdentity> {
    if (!this.googleIdentityPromise) {
      this.googleIdentityPromise = this.initializeGoogleIdentity();
    }
    return this.googleIdentityPromise;
  }

  private async initializeGoogleIdentity(): Promise<GoogleIdentity> {
    const response = await fetch('/config.json');
    if (!response.ok) {
      throw new Error('Google authentication configuration is unavailable.');
    }
    const config: unknown = await response.json();
    if (
      config === null ||
      typeof config !== 'object' ||
      !('googleClientId' in config) ||
      typeof config.googleClientId !== 'string' ||
      config.googleClientId.length === 0 ||
      !('allowedDomain' in config) ||
      typeof config.allowedDomain !== 'string' ||
      config.allowedDomain.length === 0
    ) {
      throw new Error('Google authentication configuration is incomplete.');
    }
    this.allowedDomain = config.allowedDomain;
    this.restoreSession();

    if (!window.google) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Google Identity Services failed to load.'));
        document.head.appendChild(script);
      });
    }

    const google = window.google;
    if (!google) {
      throw new Error('Google Identity Services is unavailable.');
    }
    google.accounts.id.initialize({
      client_id: config.googleClientId,
      auto_select: false,
      callback: credential => this.acceptCredential(credential.credential),
    });
    return google;
  }

  private acceptCredential(credential: string): void {
    try {
      const claims = this.claimsFromCredential(credential);
      if (!claims.sub || claims.hd !== this.allowedDomain) {
        this.clearSession();
        this.user.set(null);
        this.accessDenied.set(true);
        return;
      }

      this.idToken = credential;
      sessionStorage.setItem(GoogleAuthService.SESSION_TOKEN_KEY, credential);
      this.user.set({
        sub: claims.sub,
        email: claims.email ?? '',
        name: claims.name ?? claims.email ?? '',
        picture: claims.picture ?? '',
      });
      this.accessDenied.set(false);
      this.signInError.set(false);
    } catch {
      this.clearSession();
      this.user.set(null);
      this.signInError.set(true);
    }
  }

  private restoreSession(): void {
    const credential = sessionStorage.getItem(GoogleAuthService.SESSION_TOKEN_KEY);
    if (!credential) {
      return;
    }

    try {
      const claims = this.claimsFromCredential(credential);
      if (!claims.sub || claims.hd !== this.allowedDomain) {
        sessionStorage.removeItem(GoogleAuthService.SESSION_TOKEN_KEY);
        return;
      }

      this.idToken = credential;
      this.user.set({
        sub: claims.sub,
        email: claims.email ?? '',
        name: claims.name ?? claims.email ?? '',
        picture: claims.picture ?? '',
      });
    } catch {
      sessionStorage.removeItem(GoogleAuthService.SESSION_TOKEN_KEY);
    }
  }

  private claimsFromCredential(credential: string): GoogleClaims {
    const encodedPayload = credential.split('.')[1];
    if (!encodedPayload) {
      throw new Error('Malformed ID token.');
    }
    const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as GoogleClaims;
    if (
      typeof claims.exp !== 'number' ||
      !Number.isFinite(claims.exp) ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) {
      throw new Error('Expired ID token.');
    }
    return claims;
  }

  private clearSession(): void {
    this.idToken = null;
    sessionStorage.removeItem(GoogleAuthService.SESSION_TOKEN_KEY);
  }
}
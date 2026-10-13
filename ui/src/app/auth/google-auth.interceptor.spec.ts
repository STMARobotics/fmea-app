import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GoogleAuthService } from './google-auth.service';
import { googleAuthInterceptor } from './google-auth.interceptor';
import { HttpClient } from '@angular/common/http';

describe('googleAuthInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  const auth: {
    token: string | null;
    handleAuthorizationFailure: ReturnType<typeof vi.fn>;
  } = {
    token: 'signed-id-token',
    handleAuthorizationFailure: vi.fn(),
  };

  beforeEach(() => {
    auth.token = 'signed-id-token';
    auth.handleAuthorizationFailure.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: GoogleAuthService, useValue: auth },
        provideHttpClient(withInterceptors([googleAuthInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('attaches the ID token to API requests', () => {
    http.get('/api/teams').subscribe();
    const request = httpTesting.expectOne('/api/teams');

    expect(request.request.headers.get('Authorization')).toBe('Bearer signed-id-token');
    request.flush([]);
  });

  it('does not attach credentials to non-API requests', () => {
    http.get('/config.json').subscribe();
    const request = httpTesting.expectOne('/config.json');

    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('rejects API calls when there is no in-memory token', async () => {
    auth.token = null;

    await expect(new Promise<void>((resolve, reject) => {
      http.get('/api/teams').subscribe({ next: () => resolve(), error: reject });
    })).rejects.toMatchObject({ status: 401 });
    httpTesting.expectNone('/api/teams');
  });

  it.each([401, 403])('updates auth state after an API %s response', async status => {
    const result = new Promise<void>((resolve, reject) => {
      http.get('/api/teams').subscribe({ next: () => resolve(), error: reject });
    });
    httpTesting.expectOne('/api/teams').flush({}, { status, statusText: 'Denied' });

    await expect(result).rejects.toMatchObject({ status });
    expect(auth.handleAuthorizationFailure).toHaveBeenCalledWith(status);
  });
});
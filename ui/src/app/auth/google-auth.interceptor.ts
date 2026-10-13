import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { GoogleAuthService } from './google-auth.service';

export const googleAuthInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) {
    return next(request);
  }

  const auth = inject(GoogleAuthService);
  const token = auth.token;
  if (!token) {
    return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }));
  }

  return next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        auth.handleAuthorizationFailure(error.status);
      }
      return throwError(() => error);
    }),
  );
};
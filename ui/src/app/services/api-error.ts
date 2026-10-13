import { HttpErrorResponse } from '@angular/common/http';
import { catchError, OperatorFunction, throwError } from 'rxjs';

export const withApiError = <T>(message: string): OperatorFunction<T, T> =>
  catchError((error: HttpErrorResponse) =>
    throwError(() => new Error(`${message} (${error.status}).`)),
  );
import type { ApiErrorCode } from '@/contracts';

// Route chunks can reuse a runtime created by a different copy of this module.
const appErrorBrand = Symbol.for('gambit.AppError');

export class AppError extends Error {
  readonly [appErrorBrand] = true;
  constructor(public readonly code: ApiErrorCode, public readonly status: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof Error && appErrorBrand in error && error[appErrorBrand] === true &&
    'code' in error && typeof error.code === 'string' &&
    'status' in error && typeof error.status === 'number' && Number.isInteger(error.status) &&
    error.status >= 400 && error.status <= 599 && typeof error.message === 'string' && error.message.length > 0;
}

export type Clock = () => Date;
export const systemClock: Clock = () => new Date();

import type { ApiErrorCode } from '@/contracts';

export class AppError extends Error {
  constructor(public readonly code: ApiErrorCode, public readonly status: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export type Clock = () => Date;
export const systemClock: Clock = () => new Date();

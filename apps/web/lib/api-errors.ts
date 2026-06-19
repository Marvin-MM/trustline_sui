import type { AxiosError } from 'axios';

export enum ApiErrorCode {
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  BLOCKCHAIN_ERROR = 'BLOCKCHAIN_ERROR',
  AI_ERROR = 'AI_ERROR',
}

export class ApiError extends Error {
  code: ApiErrorCode;
  status?: number;
  details?: unknown;

  constructor(code: ApiErrorCode, message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function classifyHttpStatus(status?: number): ApiErrorCode {
  if (status === 401) return ApiErrorCode.AUTHENTICATION_ERROR;
  if (status === 403) return ApiErrorCode.AUTHORIZATION_ERROR;
  if (status === 400 || status === 422) return ApiErrorCode.VALIDATION_ERROR;
  if (status === 429) return ApiErrorCode.RATE_LIMIT_ERROR;
  if (status && status >= 500) return ApiErrorCode.SERVER_ERROR;
  return ApiErrorCode.NETWORK_ERROR;
}

export function toApiError(error: unknown): ApiError {
  const axiosError = error as AxiosError<{ error?: string; message?: string; details?: unknown }>;
  if (axiosError?.isAxiosError) {
    const status = axiosError.response?.status;
    const message =
      axiosError.response?.data?.message ??
      axiosError.response?.data?.error ??
      axiosError.message ??
      'Network request failed';
    return new ApiError(classifyHttpStatus(status), message, status, axiosError.response?.data?.details);
  }

  if (error instanceof ApiError) return error;
  if (error instanceof Error) return new ApiError(ApiErrorCode.NETWORK_ERROR, error.message);
  return new ApiError(ApiErrorCode.NETWORK_ERROR, 'Unknown error');
}

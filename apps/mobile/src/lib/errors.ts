// Error Handling Utilities
// Provides centralized error handling, logging, and user-friendly error messages

export enum ErrorCode {
  // Auth errors
  AUTH_NOT_AUTHENTICATED = 'AUTH_NOT_AUTHENTICATED',
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_SESSION_EXPIRED = 'AUTH_SESSION_EXPIRED',
  AUTH_SIGN_UP_FAILED = 'AUTH_SIGN_UP_FAILED',
  AUTH_CONFIRMATION_FAILED = 'AUTH_CONFIRMATION_FAILED',

  // Network errors
  NETWORK_NO_CONNECTION = 'NETWORK_NO_CONNECTION',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_SERVER_ERROR = 'NETWORK_SERVER_ERROR',
  NETWORK_PARSE_ERROR = 'NETWORK_PARSE_ERROR',

  // API errors
  API_NOT_FOUND = 'API_NOT_FOUND',
  API_VALIDATION_ERROR = 'API_VALIDATION_ERROR',
  API_PERMISSION_DENIED = 'API_PERMISSION_DENIED',
  API_RATE_LIMITED = 'API_RATE_LIMITED',

  // Data errors
  DATA_NOT_FOUND = 'DATA_NOT_FOUND',
  DATA_INVALID = 'DATA_INVALID',
  DATA_SYNC_FAILED = 'DATA_SYNC_FAILED',
  DATA_PERSISTENCE_FAILED = 'DATA_PERSISTENCE_FAILED',

  // Service errors
  SERVICE_AI_UNAVAILABLE = 'SERVICE_AI_UNAVAILABLE',
  SERVICE_GARMIN_DISCONNECTED = 'SERVICE_GARMIN_DISCONNECTED',
  SERVICE_FILE_UPLOAD_FAILED = 'SERVICE_FILE_UPLOAD_FAILED',

  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Custom error class
export class AppError extends Error {
  code: ErrorCode;
  severity: ErrorSeverity;
  userMessage: string;
  originalError?: Error;
  timestamp: Date;
  context?: Record<string, any>;

  constructor(
    code: ErrorCode,
    userMessage: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    originalError?: Error,
    context?: Record<string, any>
  ) {
    super(userMessage);
    this.name = 'AppError';
    this.code = code;
    this.severity = severity;
    this.userMessage = userMessage;
    this.originalError = originalError;
    this.timestamp = new Date();
    this.context = context;
  }
}

// Error message mapping
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // Auth errors
  [ErrorCode.AUTH_NOT_AUTHENTICATED]: 'Please sign in to continue',
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: 'Invalid email or password',
  [ErrorCode.AUTH_SESSION_EXPIRED]: 'Your session has expired. Please sign in again',
  [ErrorCode.AUTH_SIGN_UP_FAILED]: 'Failed to create account. Please try again',
  [ErrorCode.AUTH_CONFIRMATION_FAILED]: 'Invalid confirmation code. Please try again',

  // Network errors
  [ErrorCode.NETWORK_NO_CONNECTION]: 'No internet connection. Please check your network',
  [ErrorCode.NETWORK_TIMEOUT]: 'Request timed out. Please try again',
  [ErrorCode.NETWORK_SERVER_ERROR]: 'Server error. Please try again later',
  [ErrorCode.NETWORK_PARSE_ERROR]: 'Failed to process response. Please try again',

  // API errors
  [ErrorCode.API_NOT_FOUND]: 'The requested resource was not found',
  [ErrorCode.API_VALIDATION_ERROR]: 'Please check your input and try again',
  [ErrorCode.API_PERMISSION_DENIED]: 'You do not have permission to perform this action',
  [ErrorCode.API_RATE_LIMITED]: 'Too many requests. Please wait a moment and try again',

  // Data errors
  [ErrorCode.DATA_NOT_FOUND]: 'The requested data could not be found',
  [ErrorCode.DATA_INVALID]: 'Invalid data format',
  [ErrorCode.DATA_SYNC_FAILED]: 'Failed to sync data. Please try again',
  [ErrorCode.DATA_PERSISTENCE_FAILED]: 'Failed to save data locally',

  // Service errors
  [ErrorCode.SERVICE_AI_UNAVAILABLE]: 'AI service is unavailable. Please try again later',
  [ErrorCode.SERVICE_GARMIN_DISCONNECTED]: 'Garmin Connect is not connected',
  [ErrorCode.SERVICE_FILE_UPLOAD_FAILED]: 'Failed to upload file. Please try again',

  // Generic errors
  [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again',
};

// Error severity defaults
const ERROR_SEVERITY: Record<ErrorCode, ErrorSeverity> = {
  // Auth errors
  [ErrorCode.AUTH_NOT_AUTHENTICATED]: ErrorSeverity.MEDIUM,
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: ErrorSeverity.LOW,
  [ErrorCode.AUTH_SESSION_EXPIRED]: ErrorSeverity.MEDIUM,
  [ErrorCode.AUTH_SIGN_UP_FAILED]: ErrorSeverity.MEDIUM,
  [ErrorCode.AUTH_CONFIRMATION_FAILED]: ErrorSeverity.LOW,

  // Network errors
  [ErrorCode.NETWORK_NO_CONNECTION]: ErrorSeverity.HIGH,
  [ErrorCode.NETWORK_TIMEOUT]: ErrorSeverity.MEDIUM,
  [ErrorCode.NETWORK_SERVER_ERROR]: ErrorSeverity.HIGH,
  [ErrorCode.NETWORK_PARSE_ERROR]: ErrorSeverity.HIGH,

  // API errors
  [ErrorCode.API_NOT_FOUND]: ErrorSeverity.LOW,
  [ErrorCode.API_VALIDATION_ERROR]: ErrorSeverity.LOW,
  [ErrorCode.API_PERMISSION_DENIED]: ErrorSeverity.MEDIUM,
  [ErrorCode.API_RATE_LIMITED]: ErrorSeverity.MEDIUM,

  // Data errors
  [ErrorCode.DATA_NOT_FOUND]: ErrorSeverity.LOW,
  [ErrorCode.DATA_INVALID]: ErrorSeverity.MEDIUM,
  [ErrorCode.DATA_SYNC_FAILED]: ErrorSeverity.HIGH,
  [ErrorCode.DATA_PERSISTENCE_FAILED]: ErrorSeverity.HIGH,

  // Service errors
  [ErrorCode.SERVICE_AI_UNAVAILABLE]: ErrorSeverity.MEDIUM,
  [ErrorCode.SERVICE_GARMIN_DISCONNECTED]: ErrorSeverity.LOW,
  [ErrorCode.SERVICE_FILE_UPLOAD_FAILED]: ErrorSeverity.MEDIUM,

  // Generic errors
  [ErrorCode.UNKNOWN_ERROR]: ErrorSeverity.HIGH,
};

// ============================================
// Error Utilities
// ============================================

/**
 * Create an AppError from a generic error
 */
export function createError(
  error: unknown,
  defaultCode: ErrorCode = ErrorCode.UNKNOWN_ERROR
): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    // Try to determine the error code from the error message
    const code = determineErrorCode(error, defaultCode);
    const userMessage = ERROR_MESSAGES[code];
    const severity = ERROR_SEVERITY[code];

    return new AppError(code, userMessage, severity, error);
  }

  // For non-Error objects
  return new AppError(
    defaultCode,
    ERROR_MESSAGES[defaultCode],
    ERROR_SEVERITY[defaultCode]
  );
}

/**
 * Determine error code from error message
 */
function determineErrorCode(error: Error, defaultCode: ErrorCode): ErrorCode {
  const message = error.message.toLowerCase();

  // Network errors
  if (message.includes('network') || message.includes('fetch')) {
    if (message.includes('timeout')) return ErrorCode.NETWORK_TIMEOUT;
    return ErrorCode.NETWORK_NO_CONNECTION;
  }

  // Auth errors
  if (message.includes('unauthorized') || message.includes('401')) {
    return ErrorCode.AUTH_NOT_AUTHENTICATED;
  }
  if (message.includes('forbidden') || message.includes('403')) {
    return ErrorCode.API_PERMISSION_DENIED;
  }

  // Not found
  if (message.includes('not found') || message.includes('404')) {
    return ErrorCode.API_NOT_FOUND;
  }

  // Rate limiting
  if (message.includes('rate limit') || message.includes('429')) {
    return ErrorCode.API_RATE_LIMITED;
  }

  // Validation errors
  if (message.includes('validation') || message.includes('invalid')) {
    return ErrorCode.API_VALIDATION_ERROR;
  }

  return defaultCode;
}

/**
 * Get a user-friendly error message
 */
export function getUserMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.userMessage;
  }

  if (error instanceof Error) {
    const appError = createError(error);
    return appError.userMessage;
  }

  return ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR];
}

/**
 * Log error to console (in production, send to error tracking service)
 */
export function logError(error: unknown, context?: Record<string, any>): void {
  const appError = error instanceof AppError ? error : createError(error);

  const logEntry = {
    code: appError.code,
    message: appError.userMessage,
    severity: appError.severity,
    timestamp: appError.timestamp,
    context: { ...context, originalError: appError.originalError?.message },
  };

  // In development, log to console
  if (__DEV__) {
    console.error('[Error]', JSON.stringify(logEntry, null, 2));
  }

  // In production, send to error tracking service (e.g., Sentry, LogRocket)
  // if (Sentry) {
  //   Sentry.captureException(appError);
  // }
}

/**
 * Handle API response errors
 */
export function handleApiError(
  response: Response,
  defaultMessage: string = 'Request failed'
): AppError {
  let code = ErrorCode.API_NOT_FOUND;
  let userMessage = defaultMessage;

  switch (response.status) {
    case 400:
      code = ErrorCode.API_VALIDATION_ERROR;
      userMessage = 'Please check your input and try again';
      break;
    case 401:
      code = ErrorCode.AUTH_NOT_AUTHENTICATED;
      userMessage = ERROR_MESSAGES[code];
      break;
    case 403:
      code = ErrorCode.API_PERMISSION_DENIED;
      userMessage = ERROR_MESSAGES[code];
      break;
    case 404:
      code = ErrorCode.API_NOT_FOUND;
      userMessage = ERROR_MESSAGES[code];
      break;
    case 429:
      code = ErrorCode.API_RATE_LIMITED;
      userMessage = ERROR_MESSAGES[code];
      break;
    case 500:
    case 502:
    case 503:
      code = ErrorCode.NETWORK_SERVER_ERROR;
      userMessage = ERROR_MESSAGES[code];
      break;
    default:
      code = ErrorCode.UNKNOWN_ERROR;
      userMessage = defaultMessage;
  }

  return new AppError(code, userMessage, ERROR_SEVERITY[code]);
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }

      // Don't retry on auth or validation errors
      if (
        error instanceof AppError &&
        (error.code === ErrorCode.AUTH_INVALID_CREDENTIALS ||
          error.code === ErrorCode.API_VALIDATION_ERROR ||
          error.code === ErrorCode.API_PERMISSION_DENIED)
      ) {
        throw error;
      }

      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Max retries exceeded');
}

/**
 * Wrap an async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: {
    showError?: boolean;
    logError?: boolean;
    rethrow?: boolean;
  }
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (options?.logError !== false) {
        logError(error);
      }

      if (options?.showError) {
        // In a real implementation, show a toast notification
        console.error('Error:', getUserMessage(error));
      }

      if (options?.rethrow !== false) {
        throw error;
      }

      return null;
    }
  }) as T;
}

/**
 * Safe async handler that catches and logs errors
 */
export function safeAsync(
  fn: () => Promise<void>,
  onError?: (error: AppError) => void
): () => Promise<void> {
  return async () => {
    try {
      await fn();
    } catch (error) {
      const appError = createError(error);
      logError(appError);
      onError?.(appError);
    }
  };
}

/**
 * Error boundary state
 */
export interface ErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
}

/**
 * Reset error boundary state
 */
export function resetErrorBoundary(): ErrorBoundaryState {
  return {
    hasError: false,
    error: null,
  };
}

/**
 * Check if error is recoverable
 */
export function isRecoverableError(error: AppError): boolean {
  const recoverableCodes = [
    ErrorCode.NETWORK_TIMEOUT,
    ErrorCode.NETWORK_SERVER_ERROR,
    ErrorCode.NETWORK_NO_CONNECTION,
    ErrorCode.SERVICE_AI_UNAVAILABLE,
  ];

  return recoverableCodes.includes(error.code);
}

/**
 * Check if error is network-related
 */
export function isNetworkError(error: AppError): boolean {
  return error.code.toString().startsWith('NETWORK_');
}

/**
 * Check if error is auth-related
 */
export function isAuthError(error: AppError): boolean {
  return error.code.toString().startsWith('AUTH_');
}

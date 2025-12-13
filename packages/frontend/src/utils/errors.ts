/**
 * Type-safe error handling utilities
 * Eliminates the need for `catch (e: any)` patterns
 */

/**
 * Extract error message from an unknown error value
 * @param error - The error caught in a catch block
 * @param fallback - Fallback message if error message cannot be extracted
 * @returns A string error message
 */
export function getErrorMessage(error: unknown, fallback = 'An unknown error occurred'): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message: unknown }).message;
    if (typeof msg === 'string') {
      return msg;
    }
  }
  return fallback;
}

/**
 * Type guard to check if an error has a specific property
 */
export function hasErrorProperty<K extends string>(
  error: unknown,
  key: K
): error is { [P in K]: unknown } {
  return error !== null && typeof error === 'object' && key in error;
}

/**
 * Extract status code from an error (useful for HTTP errors)
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (hasErrorProperty(error, 'status')) {
    const status = error.status;
    if (typeof status === 'number') {
      return status;
    }
  }
  if (hasErrorProperty(error, 'statusCode')) {
    const statusCode = error.statusCode;
    if (typeof statusCode === 'number') {
      return statusCode;
    }
  }
  return undefined;
}

/**
 * Create a formatted error string for logging/display
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

/**
 * Check if error is a network/fetch error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  if (hasErrorProperty(error, 'name')) {
    const name = error.name;
    return name === 'AbortError' || name === 'NetworkError';
  }
  return false;
}

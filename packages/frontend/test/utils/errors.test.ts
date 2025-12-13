import { describe, it, expect } from 'vitest';
import {
  getErrorMessage,
  hasErrorProperty,
  getErrorStatus,
  formatError,
  isNetworkError,
} from '../../src/utils/errors';

describe('getErrorMessage', () => {
  it('extracts message from Error instance', () => {
    const err = new Error('Something went wrong');
    expect(getErrorMessage(err)).toBe('Something went wrong');
  });

  it('returns string errors directly', () => {
    expect(getErrorMessage('Raw error string')).toBe('Raw error string');
  });

  it('extracts message from error-like objects', () => {
    const errLike = { message: 'Object with message' };
    expect(getErrorMessage(errLike)).toBe('Object with message');
  });

  it('ignores non-string message properties', () => {
    const errLike = { message: 123 };
    expect(getErrorMessage(errLike)).toBe('An unknown error occurred');
  });

  it('returns fallback for null', () => {
    expect(getErrorMessage(null)).toBe('An unknown error occurred');
  });

  it('returns fallback for undefined', () => {
    expect(getErrorMessage(undefined)).toBe('An unknown error occurred');
  });

  it('returns custom fallback message', () => {
    expect(getErrorMessage(null, 'Custom fallback')).toBe('Custom fallback');
  });

  it('handles nested error objects', () => {
    const nested = { message: { inner: 'not a string' } };
    expect(getErrorMessage(nested)).toBe('An unknown error occurred');
  });

  it('handles empty object', () => {
    expect(getErrorMessage({})).toBe('An unknown error occurred');
  });

  it('handles arrays', () => {
    expect(getErrorMessage(['error', 'array'])).toBe('An unknown error occurred');
  });

  it('handles numbers', () => {
    expect(getErrorMessage(42)).toBe('An unknown error occurred');
  });

  it('handles boolean', () => {
    expect(getErrorMessage(false)).toBe('An unknown error occurred');
  });
});

describe('hasErrorProperty', () => {
  it('returns true when property exists', () => {
    const obj = { status: 404 };
    expect(hasErrorProperty(obj, 'status')).toBe(true);
  });

  it('returns false when property does not exist', () => {
    const obj = { message: 'error' };
    expect(hasErrorProperty(obj, 'status')).toBe(false);
  });

  it('returns false for null', () => {
    expect(hasErrorProperty(null, 'status')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasErrorProperty(undefined, 'status')).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(hasErrorProperty('string', 'length')).toBe(false);
  });

  it('works with Error instances', () => {
    const err = new Error('test');
    expect(hasErrorProperty(err, 'message')).toBe(true);
    expect(hasErrorProperty(err, 'stack')).toBe(true);
    expect(hasErrorProperty(err, 'notExist')).toBe(false);
  });

  it('type guards correctly', () => {
    const unknown: unknown = { code: 'ERR_001', status: 500 };
    if (hasErrorProperty(unknown, 'code')) {
      // TypeScript should now know unknown has 'code' property
      expect(unknown.code).toBe('ERR_001');
    }
  });
});

describe('getErrorStatus', () => {
  it('extracts status from error object', () => {
    const err = { status: 404 };
    expect(getErrorStatus(err)).toBe(404);
  });

  it('extracts statusCode from error object', () => {
    const err = { statusCode: 500 };
    expect(getErrorStatus(err)).toBe(500);
  });

  it('prefers status over statusCode', () => {
    const err = { status: 401, statusCode: 500 };
    expect(getErrorStatus(err)).toBe(401);
  });

  it('returns undefined for non-numeric status', () => {
    const err = { status: 'not-found' };
    expect(getErrorStatus(err)).toBeUndefined();
  });

  it('returns undefined for null', () => {
    expect(getErrorStatus(null)).toBeUndefined();
  });

  it('returns undefined for Error without status', () => {
    const err = new Error('test');
    expect(getErrorStatus(err)).toBeUndefined();
  });

  it('extracts status from axios-like error', () => {
    const axiosError = {
      response: { status: 403 },
      status: 403,
    };
    expect(getErrorStatus(axiosError)).toBe(403);
  });
});

describe('formatError', () => {
  it('formats Error instance with name and message', () => {
    const err = new Error('Something failed');
    expect(formatError(err)).toBe('Error: Something failed');
  });

  it('formats TypeError', () => {
    const err = new TypeError('Cannot read property');
    expect(formatError(err)).toBe('TypeError: Cannot read property');
  });

  it('formats RangeError', () => {
    const err = new RangeError('Invalid array length');
    expect(formatError(err)).toBe('RangeError: Invalid array length');
  });

  it('converts strings to string', () => {
    expect(formatError('plain error')).toBe('plain error');
  });

  it('converts numbers to string', () => {
    expect(formatError(42)).toBe('42');
  });

  it('converts objects to string', () => {
    expect(formatError({ code: 'ERR' })).toBe('[object Object]');
  });

  it('converts null to string', () => {
    expect(formatError(null)).toBe('null');
  });

  it('converts undefined to string', () => {
    expect(formatError(undefined)).toBe('undefined');
  });

  it('handles custom error classes', () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CustomError';
      }
    }
    const err = new CustomError('Custom message');
    expect(formatError(err)).toBe('CustomError: Custom message');
  });
});

describe('isNetworkError', () => {
  it('detects TypeError with fetch in message', () => {
    const err = new TypeError('Failed to fetch');
    expect(isNetworkError(err)).toBe(true);
  });

  it('detects AbortError', () => {
    const err = { name: 'AbortError', message: 'Request aborted' };
    expect(isNetworkError(err)).toBe(true);
  });

  it('detects NetworkError', () => {
    const err = { name: 'NetworkError', message: 'Network failed' };
    expect(isNetworkError(err)).toBe(true);
  });

  it('returns false for regular Error', () => {
    const err = new Error('Something else went wrong');
    expect(isNetworkError(err)).toBe(false);
  });

  it('returns false for TypeError without fetch', () => {
    const err = new TypeError('Cannot read property');
    expect(isNetworkError(err)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isNetworkError(null)).toBe(false);
  });

  it('returns false for string', () => {
    expect(isNetworkError('network error')).toBe(false);
  });

  it('handles fetch abort scenario', () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    // Note: DOMException may not set name property the same way in jsdom
    expect(isNetworkError({ name: 'AbortError', message: abortError.message })).toBe(true);
  });
});

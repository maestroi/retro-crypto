/**
 * Cartridge-specific error codes and error class
 */

export enum CartridgeErrorCode {
  // Validation errors (1xxx)
  INVALID_CARTRIDGE_ID = 1001,
  INVALID_CHUNK_INDEX = 1002,
  INVALID_ZIP_DATA = 1003,
  SIZE_EXCEEDED = 1004,
  INVALID_METADATA = 1005,

  // Network errors (2xxx)
  CONNECTION_FAILED = 2001,
  RPC_ERROR = 2002,
  RATE_LIMITED = 2003,
  TIMEOUT = 2004,

  // Account errors (3xxx)
  MANIFEST_NOT_FOUND = 3001,
  CHUNK_NOT_FOUND = 3002,
  CATALOG_NOT_INITIALIZED = 3003,
  ACCOUNT_ALREADY_EXISTS = 3004,

  // Data integrity errors (4xxx)
  HASH_MISMATCH = 4001,
  CHUNK_COUNT_MISMATCH = 4002,
  INCOMPLETE_CARTRIDGE = 4003,

  // Transaction errors (5xxx)
  TRANSACTION_FAILED = 5001,
  INSUFFICIENT_FUNDS = 5002,
  SIGNATURE_REQUIRED = 5003,
}

export interface CartridgeErrorDetails {
  code: CartridgeErrorCode;
  message: string;
  cause?: Error;
  context?: Record<string, unknown>;
}

/**
 * Custom error class for cartridge operations
 */
export class CartridgeError extends Error {
  readonly code: CartridgeErrorCode;
  readonly cause?: Error;
  readonly context?: Record<string, unknown>;

  constructor(details: CartridgeErrorDetails) {
    super(details.message);
    this.name = 'CartridgeError';
    this.code = details.code;
    this.cause = details.cause;
    this.context = details.context;

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CartridgeError);
    }
  }

  /**
   * Creates a human-readable error message with code
   */
  toString(): string {
    let str = `[CartridgeError ${this.code}] ${this.message}`;
    if (this.context) {
      str += ` (${JSON.stringify(this.context)})`;
    }
    return str;
  }

  /**
   * Converts error to JSON for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      stack: this.stack,
    };
  }

  // Factory methods for common errors

  static invalidCartridgeId(id: string, reason?: string): CartridgeError {
    return new CartridgeError({
      code: CartridgeErrorCode.INVALID_CARTRIDGE_ID,
      message: reason || `Invalid cartridge ID: ${id}. Must be a 64-character hex string.`,
      context: { cartridgeId: id },
    });
  }

  static invalidChunkIndex(index: number, max: number): CartridgeError {
    return new CartridgeError({
      code: CartridgeErrorCode.INVALID_CHUNK_INDEX,
      message: `Chunk index ${index} out of range (max: ${max - 1})`,
      context: { index, max },
    });
  }

  static sizeExceeded(size: number, maxSize: number): CartridgeError {
    return new CartridgeError({
      code: CartridgeErrorCode.SIZE_EXCEEDED,
      message: `Cartridge size ${size} exceeds maximum allowed size of ${maxSize} bytes`,
      context: { size, maxSize },
    });
  }

  static manifestNotFound(cartridgeId: string): CartridgeError {
    return new CartridgeError({
      code: CartridgeErrorCode.MANIFEST_NOT_FOUND,
      message: `Manifest not found for cartridge: ${cartridgeId}`,
      context: { cartridgeId },
    });
  }

  static chunkNotFound(cartridgeId: string, chunkIndex: number): CartridgeError {
    return new CartridgeError({
      code: CartridgeErrorCode.CHUNK_NOT_FOUND,
      message: `Chunk ${chunkIndex} not found for cartridge: ${cartridgeId}`,
      context: { cartridgeId, chunkIndex },
    });
  }

  static catalogNotInitialized(): CartridgeError {
    return new CartridgeError({
      code: CartridgeErrorCode.CATALOG_NOT_INITIALIZED,
      message: 'Catalog is not initialized. Run init-catalog first.',
    });
  }

  static hashMismatch(expected: string, actual: string): CartridgeError {
    return new CartridgeError({
      code: CartridgeErrorCode.HASH_MISMATCH,
      message: `SHA256 hash mismatch. Expected: ${expected}, Got: ${actual}`,
      context: { expected, actual },
    });
  }

  static rateLimited(retryAfter?: number): CartridgeError {
    return new CartridgeError({
      code: CartridgeErrorCode.RATE_LIMITED,
      message: retryAfter
        ? `Rate limited. Retry after ${retryAfter}ms`
        : 'Rate limited by RPC endpoint',
      context: { retryAfter },
    });
  }

  static transactionFailed(signature?: string, cause?: Error): CartridgeError {
    return new CartridgeError({
      code: CartridgeErrorCode.TRANSACTION_FAILED,
      message: `Transaction failed${signature ? `: ${signature}` : ''}`,
      context: { signature },
      cause,
    });
  }

  static insufficientFunds(required: number, available: number): CartridgeError {
    return new CartridgeError({
      code: CartridgeErrorCode.INSUFFICIENT_FUNDS,
      message: `Insufficient funds. Required: ${required / 1e9} SOL, Available: ${available / 1e9} SOL`,
      context: { required, available },
    });
  }

  static connectionFailed(endpoint: string, cause?: Error): CartridgeError {
    return new CartridgeError({
      code: CartridgeErrorCode.CONNECTION_FAILED,
      message: `Failed to connect to ${endpoint}`,
      context: { endpoint },
      cause,
    });
  }

  static timeout(operation: string, timeoutMs: number): CartridgeError {
    return new CartridgeError({
      code: CartridgeErrorCode.TIMEOUT,
      message: `Operation timed out: ${operation} (${timeoutMs}ms)`,
      context: { operation, timeoutMs },
    });
  }
}

/**
 * Helper to validate cartridge ID format
 */
export function validateCartridgeId(id: string): void {
  if (typeof id !== 'string') {
    throw CartridgeError.invalidCartridgeId(String(id), 'Cartridge ID must be a string');
  }
  if (!/^[0-9a-fA-F]{64}$/.test(id)) {
    throw CartridgeError.invalidCartridgeId(id);
  }
}

/**
 * Helper to wrap unknown errors as CartridgeError
 */
export function wrapError(error: unknown, defaultCode = CartridgeErrorCode.RPC_ERROR): CartridgeError {
  if (error instanceof CartridgeError) {
    return error;
  }

  const originalError = error instanceof Error ? error : new Error(String(error));

  // Check for common error patterns
  const message = originalError.message.toLowerCase();

  if (message.includes('429') || message.includes('rate limit')) {
    return CartridgeError.rateLimited();
  }

  if (message.includes('timeout') || message.includes('timed out')) {
    return new CartridgeError({
      code: CartridgeErrorCode.TIMEOUT,
      message: originalError.message,
      cause: originalError,
    });
  }

  if (message.includes('insufficient') || message.includes('not enough')) {
    return new CartridgeError({
      code: CartridgeErrorCode.INSUFFICIENT_FUNDS,
      message: originalError.message,
      cause: originalError,
    });
  }

  return new CartridgeError({
    code: defaultCode,
    message: originalError.message,
    cause: originalError,
  });
}


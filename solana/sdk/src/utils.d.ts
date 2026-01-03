/**
 * Utility functions for cartridge operations
 */
/**
 * Compute SHA256 hash of data
 * Works in both Node.js and browser environments
 */
export declare function sha256(data: Uint8Array): Promise<Uint8Array>;
/**
 * Convert bytes to hex string
 */
export declare function bytesToHex(bytes: Uint8Array): string;
/**
 * Convert hex string to bytes
 */
export declare function hexToBytes(hex: string): Uint8Array;
/**
 * Split data into chunks
 */
export declare function splitIntoChunks(data: Uint8Array, chunkSize: number): Uint8Array[];
/**
 * Concatenate multiple Uint8Arrays
 */
export declare function concatBytes(...arrays: Uint8Array[]): Uint8Array;
/**
 * Verify SHA256 hash matches expected
 */
export declare function verifySHA256(data: Uint8Array, expectedHash: Uint8Array | string): Promise<boolean>;
/**
 * Format bytes as human-readable string
 */
export declare function formatBytes(bytes: number): string;
/**
 * Sleep for a given number of milliseconds
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Retry a function with exponential backoff
 */
export declare function retry<T>(fn: () => Promise<T>, maxRetries?: number, baseDelayMs?: number): Promise<T>;
/**
 * Batch array into groups
 */
export declare function batch<T>(array: T[], size: number): T[][];

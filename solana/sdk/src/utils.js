/**
 * Utility functions for cartridge operations
 */
/**
 * Compute SHA256 hash of data
 * Works in both Node.js and browser environments
 */
export async function sha256(data) {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        // Browser/modern Node
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return new Uint8Array(hashBuffer);
    }
    else {
        // Node.js fallback
        const { createHash } = await import('crypto');
        const hash = createHash('sha256');
        hash.update(data);
        return new Uint8Array(hash.digest());
    }
}
/**
 * Convert bytes to hex string
 */
export function bytesToHex(bytes) {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
/**
 * Convert hex string to bytes
 */
export function hexToBytes(hex) {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (cleanHex.length % 2 !== 0) {
        throw new Error('Invalid hex string length');
    }
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
    }
    return bytes;
}
/**
 * Split data into chunks
 */
export function splitIntoChunks(data, chunkSize) {
    const chunks = [];
    for (let i = 0; i < data.length; i += chunkSize) {
        chunks.push(data.slice(i, Math.min(i + chunkSize, data.length)));
    }
    return chunks;
}
/**
 * Concatenate multiple Uint8Arrays
 */
export function concatBytes(...arrays) {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}
/**
 * Verify SHA256 hash matches expected
 */
export async function verifySHA256(data, expectedHash) {
    const computed = await sha256(data);
    const expected = typeof expectedHash === 'string' ? hexToBytes(expectedHash) : expectedHash;
    if (computed.length !== expected.length)
        return false;
    for (let i = 0; i < computed.length; i++) {
        if (computed[i] !== expected[i])
            return false;
    }
    return true;
}
/**
 * Format bytes as human-readable string
 */
export function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Retry a function with exponential backoff
 */
export async function retry(fn, maxRetries = 3, baseDelayMs = 1000) {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt < maxRetries - 1) {
                const delay = baseDelayMs * Math.pow(2, attempt);
                await sleep(delay);
            }
        }
    }
    throw lastError;
}
/**
 * Batch array into groups
 */
export function batch(array, size) {
    const batches = [];
    for (let i = 0; i < array.length; i += size) {
        batches.push(array.slice(i, i + size));
    }
    return batches;
}

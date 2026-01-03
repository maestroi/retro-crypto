import { PublicKey } from '@solana/web3.js';
/**
 * Type definitions for cartridge storage accounts and data
 */
/**
 * CatalogRoot account data
 */
export interface CatalogRoot {
    version: number;
    admin: PublicKey;
    totalCartridges: bigint;
    pageCount: number;
    latestPageIndex: number;
    bump: number;
}
/**
 * Single catalog entry (in CatalogPage)
 */
export interface CatalogEntry {
    cartridgeId: Uint8Array;
    manifestPubkey: PublicKey;
    zipSize: bigint;
    sha256: Uint8Array;
    createdSlot: bigint;
    flags: number;
}
/**
 * CatalogPage account data
 */
export interface CatalogPage {
    pageIndex: number;
    entryCount: number;
    bump: number;
    entries: CatalogEntry[];
}
/**
 * CartridgeManifest account data
 */
export interface CartridgeManifest {
    cartridgeId: Uint8Array;
    zipSize: bigint;
    chunkSize: number;
    numChunks: number;
    sha256: Uint8Array;
    finalized: boolean;
    createdSlot: bigint;
    publisher: PublicKey;
    metadataLen: number;
    bump: number;
    metadata: Uint8Array;
}
/**
 * CartridgeChunk account data
 */
export interface CartridgeChunk {
    cartridgeId: Uint8Array;
    chunkIndex: number;
    dataLen: number;
    written: boolean;
    bump: number;
    data: Uint8Array;
}
/**
 * Parsed cartridge with manifest and entry information
 */
export interface Cartridge {
    id: string;
    idBytes: Uint8Array;
    manifest: CartridgeManifest;
    manifestPubkey: PublicKey;
    entry?: CatalogEntry;
}
/**
 * Full cartridge with reconstructed ZIP data
 */
export interface CartridgeWithData extends Cartridge {
    zipBytes: Uint8Array;
    verified: boolean;
}
/**
 * Progress callback for fetching operations
 */
export interface FetchProgress {
    phase: 'manifest' | 'chunks' | 'verifying' | 'complete';
    chunksLoaded: number;
    totalChunks: number;
    bytesLoaded: number;
    totalBytes: number;
}
/**
 * Progress callback for publishing operations
 */
export interface PublishProgress {
    phase: 'preparing' | 'manifest' | 'chunks' | 'finalizing' | 'complete';
    chunksWritten: number;
    totalChunks: number;
    currentTx?: string;
}
/**
 * Options for listing cartridges
 */
export interface ListOptions {
    pageIndex?: number;
    includeRetired?: boolean;
}
/**
 * Result of listing cartridges
 */
export interface ListResult {
    entries: CatalogEntry[];
    totalCartridges: bigint;
    pageCount: number;
    currentPageIndex: number;
    hasMore: boolean;
}
/**
 * Options for publishing a cartridge
 */
export interface PublishOptions {
    chunkSize?: number;
    metadata?: Record<string, unknown>;
    onProgress?: (progress: PublishProgress) => void;
    skipExisting?: boolean;
}
/**
 * Result of publishing a cartridge
 */
export interface PublishResult {
    cartridgeId: Uint8Array;
    cartridgeIdHex: string;
    manifestPubkey: PublicKey;
    signatures: string[];
    alreadyExists?: boolean;
}
/**
 * Options for fetching a cartridge
 */
export interface FetchOptions {
    onProgress?: (progress: FetchProgress) => void;
    verifyHash?: boolean;
}
/**
 * Flag constants
 */
export declare const FLAGS: {
    readonly RETIRED: 1;
};

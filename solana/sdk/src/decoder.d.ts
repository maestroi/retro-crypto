import { CatalogRoot, CatalogPage, CartridgeManifest, CartridgeChunk } from './types.js';
/**
 * Account data decoders for cartridge storage accounts
 * These decode raw account data from Solana into typed structures
 */
/**
 * Decode CatalogRoot account data
 */
export declare function decodeCatalogRoot(data: Buffer | Uint8Array): CatalogRoot;
/**
 * Decode CatalogPage account data
 */
export declare function decodeCatalogPage(data: Buffer | Uint8Array): CatalogPage;
/**
 * Decode CartridgeManifest account data
 */
export declare function decodeCartridgeManifest(data: Buffer | Uint8Array): CartridgeManifest;
/**
 * Decode CartridgeChunk account data
 */
export declare function decodeCartridgeChunk(data: Buffer | Uint8Array): CartridgeChunk;
/**
 * Check if an account exists and has data
 */
export declare function accountExists(data: Buffer | Uint8Array | null): boolean;

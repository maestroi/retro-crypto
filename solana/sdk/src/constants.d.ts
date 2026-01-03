import { PublicKey } from '@solana/web3.js';
/**
 * Program ID for the cartridge storage program
 * This should match the declared ID in the Anchor program
 */
export declare const PROGRAM_ID: PublicKey;
/**
 * PDA Seeds
 */
export declare const CATALOG_ROOT_SEED: Buffer<ArrayBuffer>;
export declare const CATALOG_PAGE_SEED: Buffer<ArrayBuffer>;
export declare const MANIFEST_SEED: Buffer<ArrayBuffer>;
export declare const CHUNK_SEED: Buffer<ArrayBuffer>;
/**
 * Maximum cartridge size (6MB)
 */
export declare const MAX_CARTRIDGE_SIZE: number;
/**
 * Default chunk size (128KB)
 */
export declare const DEFAULT_CHUNK_SIZE: number;
/**
 * Entries per catalog page
 */
export declare const ENTRIES_PER_PAGE = 32;
/**
 * Maximum metadata length
 */
export declare const MAX_METADATA_LEN = 256;
/**
 * Account discriminators (first 8 bytes of sha256("account:<AccountName>"))
 */
export declare const DISCRIMINATORS: {
    catalogRoot: Buffer<ArrayBuffer>;
    catalogPage: Buffer<ArrayBuffer>;
    cartridgeManifest: Buffer<ArrayBuffer>;
    cartridgeChunk: Buffer<ArrayBuffer>;
};
/**
 * Network endpoints
 */
export declare const ENDPOINTS: {
    readonly mainnet: "https://api.mainnet-beta.solana.com";
    readonly devnet: "https://api.devnet.solana.com";
    readonly testnet: "https://api.testnet.solana.com";
    readonly localnet: "http://localhost:8899";
};
export type NetworkName = keyof typeof ENDPOINTS;

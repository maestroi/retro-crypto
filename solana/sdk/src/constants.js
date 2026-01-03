import { PublicKey } from '@solana/web3.js';
/**
 * Program ID for the cartridge storage program
 * This should match the declared ID in the Anchor program
 */
export const PROGRAM_ID = new PublicKey('CartS1QpBgPfpgq4RpPpXVuvN4SrJvYNXBfW9D1Rmvp');
/**
 * PDA Seeds
 */
export const CATALOG_ROOT_SEED = Buffer.from('catalog_root');
export const CATALOG_PAGE_SEED = Buffer.from('catalog_page');
export const MANIFEST_SEED = Buffer.from('manifest');
export const CHUNK_SEED = Buffer.from('chunk');
/**
 * Maximum cartridge size (6MB)
 */
export const MAX_CARTRIDGE_SIZE = 6 * 1024 * 1024;
/**
 * Default chunk size (128KB)
 */
export const DEFAULT_CHUNK_SIZE = 128 * 1024;
/**
 * Entries per catalog page
 */
export const ENTRIES_PER_PAGE = 32;
/**
 * Maximum metadata length
 */
export const MAX_METADATA_LEN = 256;
/**
 * Account discriminators (first 8 bytes of sha256("account:<AccountName>"))
 */
export const DISCRIMINATORS = {
    catalogRoot: Buffer.from([0x14, 0x9c, 0x1c, 0x8b, 0x5d, 0x3e, 0x2f, 0xa1]),
    catalogPage: Buffer.from([0x2e, 0x8f, 0x3c, 0x4d, 0x6b, 0x7a, 0x9e, 0xb2]),
    cartridgeManifest: Buffer.from([0x3f, 0xa0, 0x4e, 0x5c, 0x7d, 0x8e, 0xaf, 0xc3]),
    cartridgeChunk: Buffer.from([0x4b, 0xb1, 0x5f, 0x6d, 0x8e, 0x9f, 0xb0, 0xd4]),
};
/**
 * Network endpoints
 */
export const ENDPOINTS = {
    mainnet: 'https://api.mainnet-beta.solana.com',
    devnet: 'https://api.devnet.solana.com',
    testnet: 'https://api.testnet.solana.com',
    localnet: 'http://localhost:8899',
};

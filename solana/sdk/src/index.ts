/**
 * @solana-retro/sdk
 * 
 * Solana SDK for on-chain cartridge/ROM storage
 * 
 * Usage:
 * ```typescript
 * import { CartridgeClient } from '@solana-retro/sdk';
 * 
 * const client = new CartridgeClient('devnet');
 * 
 * // List cartridges
 * const { entries } = await client.listCartridges();
 * 
 * // Fetch cartridge bytes
 * const cartridge = await client.fetchCartridgeBytes(cartridgeId);
 * 
 * // Publish cartridge (requires wallet)
 * const result = await client.publishCartridge(wallet, zipBytes);
 * ```
 */

// Main client
export { CartridgeClient } from './client.js';

// PDA derivation utilities
export {
  deriveCatalogRootPDA,
  deriveCatalogPagePDA,
  deriveManifestPDA,
  deriveChunkPDA,
  deriveAllChunkPDAs,
} from './pda.js';

// Types
export type {
  CatalogRoot,
  CatalogPage,
  CatalogEntry,
  CartridgeManifest,
  CartridgeChunk,
  Cartridge,
  CartridgeWithData,
  FetchProgress,
  PublishProgress,
  ListOptions,
  ListResult,
  PublishOptions,
  PublishResult,
  FetchOptions,
} from './types.js';

export { FLAGS } from './types.js';

// Constants
export {
  PROGRAM_ID,
  CATALOG_ROOT_SEED,
  CATALOG_PAGE_SEED,
  MANIFEST_SEED,
  CHUNK_SEED,
  MAX_CARTRIDGE_SIZE,
  DEFAULT_CHUNK_SIZE,
  ENTRIES_PER_PAGE,
  MAX_METADATA_LEN,
  ENDPOINTS,
  IGNORED_CARTRIDGE_HASHES,
} from './constants.js';

export type { NetworkName } from './constants.js';

// Decoders (for advanced usage)
export {
  decodeCatalogRoot,
  decodeCatalogPage,
  decodeCartridgeManifest,
  decodeCartridgeChunk,
  accountExists,
} from './decoder.js';

// Utilities
export {
  sha256,
  bytesToHex,
  hexToBytes,
  splitIntoChunks,
  concatBytes,
  verifySHA256,
  formatBytes,
  sleep,
  retry,
  batch,
} from './utils.js';

// Errors
export {
  CartridgeError,
  CartridgeErrorCode,
  validateCartridgeId,
  wrapError,
} from './errors.js';

export type { CartridgeErrorDetails } from './errors.js';


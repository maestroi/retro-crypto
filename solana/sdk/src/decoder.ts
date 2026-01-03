import { PublicKey } from '@solana/web3.js';
import {
  CatalogRoot,
  CatalogPage,
  CatalogEntry,
  CartridgeManifest,
  CartridgeChunk,
} from './types.js';
import { ENTRIES_PER_PAGE, MAX_METADATA_LEN } from './constants.js';

/**
 * Account data decoders for cartridge storage accounts
 * These decode raw account data from Solana into typed structures
 */

/**
 * Decode CatalogRoot account data
 */
export function decodeCatalogRoot(data: Buffer | Uint8Array): CatalogRoot {
  const buffer = Buffer.from(data);
  let offset = 8; // Skip discriminator
  
  const version = buffer.readUInt8(offset);
  offset += 1;
  
  const admin = new PublicKey(buffer.subarray(offset, offset + 32));
  offset += 32;
  
  const totalCartridges = buffer.readBigUInt64LE(offset);
  offset += 8;
  
  const pageCount = buffer.readUInt32LE(offset);
  offset += 4;
  
  const latestPageIndex = buffer.readUInt32LE(offset);
  offset += 4;
  
  const bump = buffer.readUInt8(offset);
  
  return {
    version,
    admin,
    totalCartridges,
    pageCount,
    latestPageIndex,
    bump,
  };
}

/**
 * Decode a single CatalogEntry
 */
function decodeCatalogEntry(buffer: Buffer, offset: number): CatalogEntry {
  const cartridgeId = new Uint8Array(buffer.subarray(offset, offset + 32));
  offset += 32;
  
  const manifestPubkey = new PublicKey(buffer.subarray(offset, offset + 32));
  offset += 32;
  
  const zipSize = buffer.readBigUInt64LE(offset);
  offset += 8;
  
  const sha256 = new Uint8Array(buffer.subarray(offset, offset + 32));
  offset += 32;
  
  const createdSlot = buffer.readBigUInt64LE(offset);
  offset += 8;
  
  const flags = buffer.readUInt8(offset);
  
  return {
    cartridgeId,
    manifestPubkey,
    zipSize,
    sha256,
    createdSlot,
    flags,
  };
}

/**
 * Calculate catalog entry size (must match Rust)
 */
const CATALOG_ENTRY_SIZE = 32 + 32 + 8 + 32 + 8 + 1 + 7; // 120 bytes with padding

/**
 * Decode CatalogPage account data
 */
export function decodeCatalogPage(data: Buffer | Uint8Array): CatalogPage {
  const buffer = Buffer.from(data);
  let offset = 8; // Skip discriminator
  
  const pageIndex = buffer.readUInt32LE(offset);
  offset += 4;
  
  const entryCount = buffer.readUInt32LE(offset);
  offset += 4;
  
  const bump = buffer.readUInt8(offset);
  offset += 1;
  
  // Skip padding
  offset += 7;
  
  // Decode entries (only up to entryCount are valid)
  const entries: CatalogEntry[] = [];
  for (let i = 0; i < Math.min(entryCount, ENTRIES_PER_PAGE); i++) {
    entries.push(decodeCatalogEntry(buffer, offset + i * CATALOG_ENTRY_SIZE));
  }
  
  return {
    pageIndex,
    entryCount,
    bump,
    entries,
  };
}

/**
 * Decode CartridgeManifest account data
 */
export function decodeCartridgeManifest(data: Buffer | Uint8Array): CartridgeManifest {
  const buffer = Buffer.from(data);
  let offset = 8; // Skip discriminator
  
  const cartridgeId = new Uint8Array(buffer.subarray(offset, offset + 32));
  offset += 32;
  
  const zipSize = buffer.readBigUInt64LE(offset);
  offset += 8;
  
  const chunkSize = buffer.readUInt32LE(offset);
  offset += 4;
  
  const numChunks = buffer.readUInt32LE(offset);
  offset += 4;
  
  const sha256 = new Uint8Array(buffer.subarray(offset, offset + 32));
  offset += 32;
  
  const finalized = buffer.readUInt8(offset) !== 0;
  offset += 1;
  
  const createdSlot = buffer.readBigUInt64LE(offset);
  offset += 8;
  
  const publisher = new PublicKey(buffer.subarray(offset, offset + 32));
  offset += 32;
  
  const metadataLen = buffer.readUInt16LE(offset);
  offset += 2;
  
  const bump = buffer.readUInt8(offset);
  offset += 1;
  
  const metadata = new Uint8Array(buffer.subarray(offset, offset + Math.min(metadataLen, MAX_METADATA_LEN)));
  
  return {
    cartridgeId,
    zipSize,
    chunkSize,
    numChunks,
    sha256,
    finalized,
    createdSlot,
    publisher,
    metadataLen,
    bump,
    metadata,
  };
}

/**
 * Decode CartridgeChunk account data
 */
export function decodeCartridgeChunk(data: Buffer | Uint8Array): CartridgeChunk {
  const buffer = Buffer.from(data);
  let offset = 8; // Skip discriminator
  
  const cartridgeId = new Uint8Array(buffer.subarray(offset, offset + 32));
  offset += 32;
  
  const chunkIndex = buffer.readUInt32LE(offset);
  offset += 4;
  
  const dataLen = buffer.readUInt32LE(offset);
  offset += 4;
  
  const written = buffer.readUInt8(offset) !== 0;
  offset += 1;
  
  const bump = buffer.readUInt8(offset);
  offset += 1;
  
  // Read vec length prefix
  const vecLen = buffer.readUInt32LE(offset);
  offset += 4;
  
  const chunkData = new Uint8Array(buffer.subarray(offset, offset + Math.min(vecLen, dataLen)));
  
  return {
    cartridgeId,
    chunkIndex,
    dataLen,
    written,
    bump,
    data: chunkData,
  };
}

/**
 * Check if an account exists and has data
 */
export function accountExists(data: Buffer | Uint8Array | null): boolean {
  return data !== null && data.length > 0;
}


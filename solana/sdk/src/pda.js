import { PublicKey } from '@solana/web3.js';
import { PROGRAM_ID, CATALOG_ROOT_SEED, CATALOG_PAGE_SEED, MANIFEST_SEED, CHUNK_SEED, } from './constants.js';
/**
 * PDA derivation utilities for the cartridge storage program
 */
/**
 * Derive the CatalogRoot PDA
 * Seeds: ["catalog_root"]
 */
export function deriveCatalogRootPDA(programId = PROGRAM_ID) {
    return PublicKey.findProgramAddressSync([CATALOG_ROOT_SEED], programId);
}
/**
 * Derive a CatalogPage PDA
 * Seeds: ["catalog_page", u32 page_index]
 */
export function deriveCatalogPagePDA(pageIndex, programId = PROGRAM_ID) {
    const pageIndexBuffer = Buffer.alloc(4);
    pageIndexBuffer.writeUInt32LE(pageIndex);
    return PublicKey.findProgramAddressSync([CATALOG_PAGE_SEED, pageIndexBuffer], programId);
}
/**
 * Derive a CartridgeManifest PDA
 * Seeds: ["manifest", cartridge_id]
 * @param cartridgeId - 32-byte cartridge ID (sha256 of ZIP bytes)
 */
export function deriveManifestPDA(cartridgeId, programId = PROGRAM_ID) {
    if (cartridgeId.length !== 32) {
        throw new Error(`Invalid cartridge ID length: expected 32, got ${cartridgeId.length}`);
    }
    return PublicKey.findProgramAddressSync([MANIFEST_SEED, Buffer.from(cartridgeId)], programId);
}
/**
 * Derive a CartridgeChunk PDA
 * Seeds: ["chunk", cartridge_id, u32 chunk_index]
 */
export function deriveChunkPDA(cartridgeId, chunkIndex, programId = PROGRAM_ID) {
    if (cartridgeId.length !== 32) {
        throw new Error(`Invalid cartridge ID length: expected 32, got ${cartridgeId.length}`);
    }
    const chunkIndexBuffer = Buffer.alloc(4);
    chunkIndexBuffer.writeUInt32LE(chunkIndex);
    return PublicKey.findProgramAddressSync([CHUNK_SEED, Buffer.from(cartridgeId), chunkIndexBuffer], programId);
}
/**
 * Derive all chunk PDAs for a cartridge
 */
export function deriveAllChunkPDAs(cartridgeId, numChunks, programId = PROGRAM_ID) {
    const pdas = [];
    for (let i = 0; i < numChunks; i++) {
        pdas.push(deriveChunkPDA(cartridgeId, i, programId));
    }
    return pdas;
}

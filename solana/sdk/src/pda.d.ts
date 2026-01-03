import { PublicKey } from '@solana/web3.js';
/**
 * PDA derivation utilities for the cartridge storage program
 */
/**
 * Derive the CatalogRoot PDA
 * Seeds: ["catalog_root"]
 */
export declare function deriveCatalogRootPDA(programId?: PublicKey): [PublicKey, number];
/**
 * Derive a CatalogPage PDA
 * Seeds: ["catalog_page", u32 page_index]
 */
export declare function deriveCatalogPagePDA(pageIndex: number, programId?: PublicKey): [PublicKey, number];
/**
 * Derive a CartridgeManifest PDA
 * Seeds: ["manifest", cartridge_id]
 * @param cartridgeId - 32-byte cartridge ID (sha256 of ZIP bytes)
 */
export declare function deriveManifestPDA(cartridgeId: Uint8Array | Buffer, programId?: PublicKey): [PublicKey, number];
/**
 * Derive a CartridgeChunk PDA
 * Seeds: ["chunk", cartridge_id, u32 chunk_index]
 */
export declare function deriveChunkPDA(cartridgeId: Uint8Array | Buffer, chunkIndex: number, programId?: PublicKey): [PublicKey, number];
/**
 * Derive all chunk PDAs for a cartridge
 */
export declare function deriveAllChunkPDAs(cartridgeId: Uint8Array | Buffer, numChunks: number, programId?: PublicKey): Array<[PublicKey, number]>;

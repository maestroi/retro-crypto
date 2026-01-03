/**
 * Solana RPC Client wrapper
 * Provides similar interface to NimiqRPC for easy integration
 */

import { Connection, PublicKey } from '@solana/web3.js'

// Program constants (matching SDK)
const PROGRAM_ID = new PublicKey('CartS1QpBgPfpgq4RpPpXVuvN4SrJvYNXBfW9D1Rmvp')
const CATALOG_ROOT_SEED = Buffer.from('catalog_root')
const CATALOG_PAGE_SEED = Buffer.from('catalog_page')
const MANIFEST_SEED = Buffer.from('manifest')
const CHUNK_SEED = Buffer.from('chunk')
const ENTRIES_PER_PAGE = 32
const CATALOG_ENTRY_SIZE = 120

// PDA derivation
function deriveCatalogRootPDA() {
  return PublicKey.findProgramAddressSync([CATALOG_ROOT_SEED], PROGRAM_ID)
}

function deriveCatalogPagePDA(pageIndex) {
  const pageIndexBuffer = Buffer.alloc(4)
  pageIndexBuffer.writeUInt32LE(pageIndex)
  return PublicKey.findProgramAddressSync([CATALOG_PAGE_SEED, pageIndexBuffer], PROGRAM_ID)
}

function deriveManifestPDA(cartridgeId) {
  const idBytes = typeof cartridgeId === 'string' ? hexToBytes(cartridgeId) : cartridgeId
  return PublicKey.findProgramAddressSync([MANIFEST_SEED, Buffer.from(idBytes)], PROGRAM_ID)
}

function deriveChunkPDA(cartridgeId, chunkIndex) {
  const idBytes = typeof cartridgeId === 'string' ? hexToBytes(cartridgeId) : cartridgeId
  const chunkIndexBuffer = Buffer.alloc(4)
  chunkIndexBuffer.writeUInt32LE(chunkIndex)
  return PublicKey.findProgramAddressSync([CHUNK_SEED, Buffer.from(idBytes), chunkIndexBuffer], PROGRAM_ID)
}

// Utility functions
function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex) {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(cleanHex.length / 2)
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16)
  }
  return bytes
}

// Decode functions
function decodeCatalogRoot(data) {
  const buffer = Buffer.from(data)
  let offset = 8
  
  const version = buffer.readUInt8(offset)
  offset += 1
  
  const admin = new PublicKey(buffer.subarray(offset, offset + 32))
  offset += 32
  
  const totalCartridges = buffer.readBigUInt64LE(offset)
  offset += 8
  
  const pageCount = buffer.readUInt32LE(offset)
  offset += 4
  
  const latestPageIndex = buffer.readUInt32LE(offset)
  
  return { version, admin, totalCartridges: Number(totalCartridges), pageCount, latestPageIndex }
}

function decodeCatalogEntry(buffer, offset) {
  const cartridgeId = new Uint8Array(buffer.subarray(offset, offset + 32))
  offset += 32
  
  const manifestPubkey = new PublicKey(buffer.subarray(offset, offset + 32))
  offset += 32
  
  const zipSize = buffer.readBigUInt64LE(offset)
  offset += 8
  
  const sha256 = new Uint8Array(buffer.subarray(offset, offset + 32))
  offset += 32
  
  const createdSlot = buffer.readBigUInt64LE(offset)
  offset += 8
  
  const flags = buffer.readUInt8(offset)
  
  return { 
    cartridgeId, 
    cartridgeIdHex: bytesToHex(cartridgeId),
    manifestPubkey, 
    zipSize: Number(zipSize), 
    sha256,
    sha256Hex: bytesToHex(sha256),
    createdSlot: Number(createdSlot), 
    flags 
  }
}

function decodeCatalogPage(data) {
  const buffer = Buffer.from(data)
  let offset = 8
  
  const pageIndex = buffer.readUInt32LE(offset)
  offset += 4
  
  const entryCount = buffer.readUInt32LE(offset)
  offset += 4
  
  const bump = buffer.readUInt8(offset)
  offset += 8 // include padding
  
  const entries = []
  for (let i = 0; i < Math.min(entryCount, ENTRIES_PER_PAGE); i++) {
    entries.push(decodeCatalogEntry(buffer, offset + i * CATALOG_ENTRY_SIZE))
  }
  
  return { pageIndex, entryCount, bump, entries }
}

function decodeCartridgeManifest(data) {
  const buffer = Buffer.from(data)
  let offset = 8
  
  const cartridgeId = new Uint8Array(buffer.subarray(offset, offset + 32))
  offset += 32
  
  const zipSize = buffer.readBigUInt64LE(offset)
  offset += 8
  
  const chunkSize = buffer.readUInt32LE(offset)
  offset += 4
  
  const numChunks = buffer.readUInt32LE(offset)
  offset += 4
  
  const sha256 = new Uint8Array(buffer.subarray(offset, offset + 32))
  offset += 32
  
  const finalized = buffer.readUInt8(offset) !== 0
  offset += 1
  
  const createdSlot = buffer.readBigUInt64LE(offset)
  offset += 8
  
  const publisher = new PublicKey(buffer.subarray(offset, offset + 32))
  offset += 32
  
  const metadataLen = buffer.readUInt16LE(offset)
  offset += 2
  
  const bump = buffer.readUInt8(offset)
  offset += 1
  
  const metadata = buffer.subarray(offset, offset + metadataLen)
  
  return {
    cartridgeId,
    cartridgeIdHex: bytesToHex(cartridgeId),
    zipSize: Number(zipSize),
    chunkSize,
    numChunks,
    sha256,
    sha256Hex: bytesToHex(sha256),
    finalized,
    createdSlot: Number(createdSlot),
    publisher,
    metadataLen,
    bump,
    metadata
  }
}

function decodeCartridgeChunk(data) {
  const buffer = Buffer.from(data)
  let offset = 8
  
  offset += 32 // cartridgeId
  offset += 4 // chunkIndex
  
  const dataLen = buffer.readUInt32LE(offset)
  offset += 4
  
  offset += 1 // written
  offset += 1 // bump
  
  const vecLen = buffer.readUInt32LE(offset)
  offset += 4
  
  return new Uint8Array(buffer.subarray(offset, offset + Math.min(vecLen, dataLen)))
}

/**
 * SolanaRPC - Wrapper around @solana/web3.js Connection
 * Provides methods for interacting with the cartridge storage program
 */
export class SolanaRPC {
  constructor(url) {
    this.url = url
    this.connection = new Connection(url, 'confirmed')
  }

  /**
   * Get catalog root account
   */
  async getCatalogRoot() {
    const [pda] = deriveCatalogRootPDA()
    const info = await this.connection.getAccountInfo(pda)
    if (!info) return null
    return decodeCatalogRoot(info.data)
  }

  /**
   * Get catalog page by index
   */
  async getCatalogPage(pageIndex) {
    const [pda] = deriveCatalogPagePDA(pageIndex)
    const info = await this.connection.getAccountInfo(pda)
    if (!info) return null
    return decodeCatalogPage(info.data)
  }

  /**
   * Get all catalog entries
   */
  async getAllCatalogEntries() {
    const root = await this.getCatalogRoot()
    if (!root) return []
    
    const entries = []
    for (let i = 0; i < root.pageCount; i++) {
      const page = await this.getCatalogPage(i)
      if (page) {
        entries.push(...page.entries)
      }
    }
    return entries
  }

  /**
   * Get cartridge manifest by ID
   */
  async getManifest(cartridgeId) {
    const [pda] = deriveManifestPDA(cartridgeId)
    const info = await this.connection.getAccountInfo(pda)
    if (!info) return null
    return decodeCartridgeManifest(info.data)
  }

  /**
   * Fetch cartridge chunks
   * @param {string|Uint8Array} cartridgeId 
   * @param {number} numChunks 
   * @param {Function} onProgress - Optional progress callback
   * @returns {Promise<Uint8Array[]>}
   */
  async fetchChunks(cartridgeId, numChunks, onProgress = null) {
    const BATCH_SIZE = 100
    const chunks = new Array(numChunks).fill(null)
    let loaded = 0
    
    // Derive all chunk PDAs
    const chunkPDAs = []
    for (let i = 0; i < numChunks; i++) {
      const [pda] = deriveChunkPDA(cartridgeId, i)
      chunkPDAs.push(pda)
    }
    
    // Fetch in batches
    for (let start = 0; start < chunkPDAs.length; start += BATCH_SIZE) {
      const end = Math.min(start + BATCH_SIZE, chunkPDAs.length)
      const batch = chunkPDAs.slice(start, end)
      
      const infos = await this.connection.getMultipleAccountsInfo(batch)
      
      for (let i = 0; i < infos.length; i++) {
        const info = infos[i]
        if (info && info.data) {
          chunks[start + i] = decodeCartridgeChunk(info.data)
          loaded++
        }
      }
      
      if (onProgress) {
        onProgress({ loaded, total: numChunks })
      }
    }
    
    return chunks
  }

  /**
   * Fetch full cartridge ZIP bytes
   */
  async fetchCartridgeBytes(cartridgeId, onProgress = null) {
    const manifest = await this.getManifest(cartridgeId)
    if (!manifest) {
      throw new Error('Manifest not found')
    }
    
    const chunks = await this.fetchChunks(cartridgeId, manifest.numChunks, onProgress)
    
    // Check for missing chunks
    const missing = chunks.reduce((acc, c, i) => c === null ? [...acc, i] : acc, [])
    if (missing.length > 0) {
      throw new Error(`Missing chunks: ${missing.join(', ')}`)
    }
    
    // Concatenate
    const totalSize = manifest.zipSize
    const result = new Uint8Array(totalSize)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    
    return {
      manifest,
      zipBytes: result
    }
  }

  /**
   * Get SOL balance
   */
  async getBalance(address) {
    const pubkey = typeof address === 'string' ? new PublicKey(address) : address
    return this.connection.getBalance(pubkey)
  }
}

// Export utilities
export {
  PROGRAM_ID,
  deriveCatalogRootPDA,
  deriveCatalogPagePDA,
  deriveManifestPDA,
  deriveChunkPDA,
  bytesToHex,
  hexToBytes,
  decodeCatalogRoot,
  decodeCatalogPage,
  decodeCartridgeManifest,
  decodeCartridgeChunk
}


/**
 * Solana Protocol Driver
 * 
 * Implements the protocol driver interface for Solana blockchain.
 * Uses account-based storage with PDAs for manifest and chunks.
 */

import { Buffer } from 'buffer'
import { Connection, PublicKey } from '@solana/web3.js'
import { verifySHA256, bytesToHex } from '../utils/payloads.js'

// Program constants
const PROGRAM_ID = new PublicKey('iXBRbJjLtohupYmSDz3diKTVz2wU8NXe4gezFsSNcy1')
const CATALOG_ROOT_SEED = Buffer.from('catalog_root')
const CATALOG_PAGE_SEED = Buffer.from('catalog_page')
const MANIFEST_SEED = Buffer.from('manifest')
const CHUNK_SEED = Buffer.from('chunk')
const ENTRIES_PER_PAGE = 16
const CATALOG_ENTRY_SIZE = 120

// Rent calculation constants
const RENT_PER_BYTE = 0.00000696 // SOL per byte (rent-exempt)
const ACCOUNT_OVERHEAD = 128 // bytes per account
const CHUNK_DATA_SIZE = 800 // default chunk data size (DEFAULT_CHUNK_SIZE)
const MANIFEST_DATA_SIZE = 200 // approximate manifest data size

// Ignored cartridge hashes (test/broken uploads)
const IGNORED_CARTRIDGE_HASHES = new Set([
  // Add any cartridge hashes to ignore here
])

// PDA derivation functions
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
  offset += 4
  
  const bump = buffer.readUInt8(offset)
  
  return { version, admin, totalCartridges, pageCount, latestPageIndex, bump }
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
  
  return { cartridgeId, manifestPubkey, zipSize, sha256, createdSlot, flags }
}

function decodeCatalogPage(data) {
  const buffer = Buffer.from(data)
  let offset = 8
  
  const pageIndex = buffer.readUInt32LE(offset)
  offset += 4
  
  const entryCount = buffer.readUInt32LE(offset)
  offset += 4
  
  const bump = buffer.readUInt8(offset)
  offset += 1
  offset += 7 // padding
  
  const entries = []
  for (let i = 0; i < Math.min(entryCount, ENTRIES_PER_PAGE); i++) {
    entries.push(decodeCatalogEntry(buffer, offset + i * CATALOG_ENTRY_SIZE))
  }
  
  return { pageIndex, entryCount, bump, entries }
}

function decodeManifestMetadata(data) {
  const buffer = Buffer.from(data)
  let offset = 8
  
  offset += 32 + 8 + 4 + 4 + 32 // Skip cartridge_id, zip_size, chunk_size, num_chunks, sha256
  offset += 1 + 7 // finalized + padding
  offset += 8 + 32 // created_slot + publisher
  
  const metadataLen = buffer.readUInt16LE(offset)
  offset += 2
  offset += 1 + 5 // bump + padding
  
  if (metadataLen > 0 && metadataLen <= 256) {
    try {
      const metadataBytes = buffer.subarray(offset, offset + metadataLen)
      const metadataStr = new TextDecoder().decode(metadataBytes)
      return JSON.parse(metadataStr)
    } catch (e) {
      return null
    }
  }
  return null
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
  offset += 7 // padding
  
  const createdSlot = buffer.readBigUInt64LE(offset)
  offset += 8
  
  const publisher = new PublicKey(buffer.subarray(offset, offset + 32))
  offset += 32
  
  const metadataLen = buffer.readUInt16LE(offset)
  offset += 2
  
  const bump = buffer.readUInt8(offset)
  offset += 1
  offset += 5 // padding
  
  const metadata = buffer.subarray(offset, offset + metadataLen)
  
  return {
    cartridgeId,
    zipSize: Number(zipSize),
    chunkSize,
    numChunks,
    sha256,
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
  offset += 6 // padding
  
  return new Uint8Array(buffer.subarray(offset, offset + dataLen))
}

/**
 * Rate limiter for public RPC endpoints
 */
function createRateLimiter(maxRequests = 40, windowMs = 10000) {
  const timestamps = []
  let retryUntil = 0
  
  return {
    async rateLimit() {
      const now = Date.now()
      if (now < retryUntil) {
        await new Promise(r => setTimeout(r, retryUntil - now))
      }
      
      while (timestamps.length > 0 && now - timestamps[0] >= windowMs) {
        timestamps.shift()
      }
      
      if (timestamps.length >= maxRequests) {
        const wait = windowMs - (now - timestamps[0]) + 50
        if (wait > 0) await new Promise(r => setTimeout(r, wait))
      }
      
      timestamps.push(Date.now())
    },
    handle429() {
      retryUntil = Date.now() + 1100
    }
  }
}

function isCustomRpcEndpoint(url) {
  if (!url) return false
  const defaults = [
    'https://api.testnet.solana.com',
    'https://api.devnet.solana.com',
    'https://api.mainnet-beta.solana.com'
  ]
  return !defaults.some(d => url.includes(d))
}

/**
 * Create Solana Protocol Driver
 */
export function createSolanaDriver(rpcUrl) {
  const rateLimiter = createRateLimiter()
  const isCustom = isCustomRpcEndpoint(rpcUrl)
  
  async function getConnection() {
    if (!isCustom) await rateLimiter.rateLimit()
    return new Connection(rpcUrl, 'confirmed')
  }
  
  return {
    protocolId: 'solana',
    rpcUrl,
    
    /**
     * Load catalog of games from Solana blockchain
     */
    async loadCatalog(catalogAddress, publisherAddress = null, showRetiredRef = null) {
      const connection = await getConnection()
      
      // Fetch catalog root
      const [catalogRootPDA] = deriveCatalogRootPDA()
      const rootInfo = await connection.getAccountInfo(catalogRootPDA)
      
      if (!rootInfo) {
        throw new Error('Catalog not initialized on this network')
      }
      
      const catalogRoot = decodeCatalogRoot(rootInfo.data)
      console.log(`Catalog found: ${catalogRoot.totalCartridges} cartridges in ${catalogRoot.pageCount} pages`)
      
      // Fetch all pages
      const entries = []
      for (let pageIdx = 0; pageIdx < catalogRoot.pageCount; pageIdx++) {
        const [pagePDA] = deriveCatalogPagePDA(pageIdx)
        if (!isCustom) await rateLimiter.rateLimit()
        const pageInfo = await connection.getAccountInfo(pagePDA)
        
        if (pageInfo) {
          const page = decodeCatalogPage(pageInfo.data)
          entries.push(...page.entries)
        }
      }
      
      console.log(`Fetched ${entries.length} catalog entries`)
      
      const FLAG_RETIRED = 0x01
      const shouldShowRetired = showRetiredRef?.value ?? false
      
      // Fetch manifests to get metadata
      const manifestPDAs = entries.map(entry => {
        const [pda] = deriveManifestPDA(entry.cartridgeId)
        return pda
      })
      
      const manifestInfos = []
      for (let i = 0; i < manifestPDAs.length; i += 100) {
        const batch = manifestPDAs.slice(i, i + 100)
        if (!isCustom) await rateLimiter.rateLimit()
        const infos = await connection.getMultipleAccountsInfo(batch)
        manifestInfos.push(...infos)
      }
      
      // Convert to game format
      const games = []
      
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        const isRetired = (entry.flags & FLAG_RETIRED) !== 0
        if (isRetired && !shouldShowRetired) continue
        
        const cartridgeIdHex = bytesToHex(entry.cartridgeId)
        
        if (IGNORED_CARTRIDGE_HASHES.has(cartridgeIdHex.toLowerCase())) {
          continue
        }
        
        let metadata = null
        if (manifestInfos[i]) {
          metadata = decodeManifestMetadata(manifestInfos[i].data)
        }
        
        const title = metadata?.name || `Game ${cartridgeIdHex.substring(0, 8)}...`
        const platform = (metadata?.platform || 'DOS').toUpperCase()
        
        games.push({
          appId: cartridgeIdHex,
          title,
          platform,
          year: metadata?.year,
          publisher: metadata?.publisher,
          description: metadata?.description,
          retired: isRetired,
          versions: [{
            semver: { major: 1, minor: 0, patch: 0, string: '1.0.0' },
            cartridgeAddress: cartridgeIdHex,
            cartridgeId: entry.cartridgeId,
            manifestPubkey: entry.manifestPubkey,
            zipSize: Number(entry.zipSize),
            sha256: bytesToHex(entry.sha256),
            createdSlot: Number(entry.createdSlot),
            flags: entry.flags
          }]
        })
      }
      
      return games
    },
    
    /**
     * Load cartridge header/manifest info without downloading chunks
     */
    async loadCartridgeInfo(cartridgeAddress) {
      if (!cartridgeAddress) {
        throw new Error('Cartridge ID not configured')
      }
      
      const connection = await getConnection()
      const [manifestPDA] = deriveManifestPDA(cartridgeAddress)
      const manifestInfo = await connection.getAccountInfo(manifestPDA)
      
      if (!manifestInfo) {
        return null
      }
      
      const manifest = decodeCartridgeManifest(manifestInfo.data)
      
      let metadata = {}
      if (manifest.metadataLen > 0) {
        try {
          const metadataStr = new TextDecoder().decode(manifest.metadata)
          metadata = JSON.parse(metadataStr)
        } catch (e) {
          console.warn('Failed to parse manifest metadata:', e)
        }
      }
      
      // Calculate total locked value (rent) using rent-per-byte calculation
      // Use actual numChunks from manifest, or calculate from totalSize and chunkSize
      const chunkSize = manifest.chunkSize || CHUNK_DATA_SIZE
      const chunkCount = manifest.numChunks || Math.ceil(manifest.zipSize / chunkSize)
      
      // Calculate total bytes stored on-chain
      const manifestBytes = ACCOUNT_OVERHEAD + MANIFEST_DATA_SIZE
      const chunkBytes = chunkCount * (ACCOUNT_OVERHEAD + chunkSize)
      const totalBytes = manifestBytes + chunkBytes
      
      // Calculate rent cost
      const totalLockedValueSOL = totalBytes * RENT_PER_BYTE
      const manifestRentSOL = manifestBytes * RENT_PER_BYTE
      const chunkRentPerAccountSOL = (ACCOUNT_OVERHEAD + chunkSize) * RENT_PER_BYTE
      const totalChunkRentSOL = chunkRentPerAccountSOL * chunkCount
      
      // Convert to lamports for consistency
      const totalLockedValue = totalLockedValueSOL * 1e9
      
      return {
        cartridgeId: bytesToHex(manifest.cartridgeId),
        totalSize: manifest.zipSize,
        chunkSize: manifest.chunkSize,
        numChunks: manifest.numChunks,
        sha256: bytesToHex(manifest.sha256),
        finalized: manifest.finalized,
        createdSlot: manifest.createdSlot,
        publisher: manifest.publisher.toBase58(),
        platform: (metadata.platform || 'DOS').toUpperCase(),
        metadata,
        lockedValue: totalLockedValue, // Total locked value in lamports
        lockedValueSOL: totalLockedValueSOL, // Total locked value in SOL
        chunkRentPerAccount: chunkRentPerAccountSOL, // Rent per chunk in SOL
        numChunks: chunkCount, // Number of chunks for display
        totalBytes: totalBytes // Total bytes stored on-chain
      }
    },
    
    /**
     * Load full cartridge (download all chunks and verify)
     */
    async loadCartridge(cartridgeAddress, publisherAddress = null, onProgress = () => {}) {
      if (!cartridgeAddress) {
        throw new Error('Cartridge ID not configured')
      }
      
      // First get manifest
      const cartHeader = await this.loadCartridgeInfo(cartridgeAddress)
      if (!cartHeader) {
        throw new Error('Cartridge manifest not found')
      }
      
      const numChunks = cartHeader.numChunks
      const totalBytes = cartHeader.totalSize
      const startTime = Date.now()
      
      onProgress({
        chunksFound: 0,
        expectedChunks: numChunks,
        bytes: 0,
        rate: 0,
        phase: 'fetching-chunks',
        statusMessage: 'Downloading chunks from Solana...'
      })
      
      // Derive all chunk PDAs
      const chunkPDAs = []
      for (let i = 0; i < numChunks; i++) {
        const [pda] = deriveChunkPDA(cartridgeAddress, i)
        chunkPDAs.push(pda)
      }
      
      // Fetch chunks in batches
      const BATCH_SIZE = 100
      const chunks = new Array(numChunks).fill(null)
      let chunksLoaded = 0
      let bytesLoaded = 0
      
      const connection = await getConnection()
      
      for (let i = 0; i < chunkPDAs.length; i += BATCH_SIZE) {
        const batch = chunkPDAs.slice(i, i + BATCH_SIZE)
        if (!isCustom) await rateLimiter.rateLimit()
        
        const infos = await connection.getMultipleAccountsInfo(batch)
        
        for (let j = 0; j < infos.length; j++) {
          const info = infos[j]
          if (info && info.data) {
            const chunkData = decodeCartridgeChunk(info.data)
            chunks[i + j] = chunkData
            chunksLoaded++
            bytesLoaded += chunkData.length
          }
        }
        
        onProgress({
          chunksFound: chunksLoaded,
          expectedChunks: numChunks,
          bytes: bytesLoaded,
          rate: chunksLoaded / ((Date.now() - startTime) / 1000),
          phase: 'fetching-chunks',
          statusMessage: `Downloaded ${chunksLoaded}/${numChunks} chunks...`
        })
      }
      
      // Check for missing chunks
      const missing = chunks.reduce((acc, c, i) => c === null ? [...acc, i] : acc, [])
      if (missing.length > 0) {
        throw new Error(`Missing ${missing.length} chunks: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '...' : ''}`)
      }
      
      // Reconstruct ZIP
      onProgress({
        chunksFound: numChunks,
        expectedChunks: numChunks,
        bytes: bytesLoaded,
        rate: 0,
        phase: 'reconstructing',
        statusMessage: 'Reconstructing file...'
      })
      
      const reconstructed = new Uint8Array(totalBytes)
      let offset = 0
      for (const chunk of chunks) {
        reconstructed.set(chunk, offset)
        offset += chunk.length
      }
      
      // Verify SHA256
      onProgress({
        chunksFound: numChunks,
        expectedChunks: numChunks,
        bytes: totalBytes,
        rate: 0,
        phase: 'verifying',
        statusMessage: 'Verifying integrity...'
      })
      
      const isValid = await verifySHA256(reconstructed, cartHeader.sha256)
      
      if (!isValid) {
        throw new Error('SHA256 verification failed!')
      }
      
      return {
        fileData: reconstructed,
        verified: true,
        cartHeader
      }
    }
  }
}


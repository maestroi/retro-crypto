import { ref, computed } from 'vue'
import { Connection, PublicKey } from '@solana/web3.js'
import { createRateLimiter, isCustomRpcEndpoint } from '../utils.js'
import { IGNORED_CARTRIDGE_HASHES } from '../constants.js'

/**
 * Solana Catalog loader composable
 * Fetches catalog entries from on-chain Solana accounts
 */

// Program constants - must match deployed program
const PROGRAM_ID = new PublicKey('iXBRbJjLtohupYmSDz3diKTVz2wU8NXe4gezFsSNcy1')
const CATALOG_ROOT_SEED = Buffer.from('catalog_root')
const CATALOG_PAGE_SEED = Buffer.from('catalog_page')
const MANIFEST_SEED = Buffer.from('manifest')

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
  return PublicKey.findProgramAddressSync([MANIFEST_SEED, cartridgeId], PROGRAM_ID)
}

// Decode functions
function decodeCatalogRoot(data) {
  const buffer = Buffer.from(data)
  let offset = 8 // Skip discriminator
  
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

const CATALOG_ENTRY_SIZE = 32 + 32 + 8 + 32 + 8 + 1 + 7 // 120 bytes with padding
const ENTRIES_PER_PAGE = 16 // Must match Rust program

function decodeCatalogPage(data) {
  const buffer = Buffer.from(data)
  let offset = 8 // Skip discriminator
  
  const pageIndex = buffer.readUInt32LE(offset)
  offset += 4
  
  const entryCount = buffer.readUInt32LE(offset)
  offset += 4
  
  const bump = buffer.readUInt8(offset)
  offset += 1
  
  // Skip padding
  offset += 7
  
  const entries = []
  for (let i = 0; i < Math.min(entryCount, ENTRIES_PER_PAGE); i++) {
    entries.push(decodeCatalogEntry(buffer, offset + i * CATALOG_ENTRY_SIZE))
  }
  
  return { pageIndex, entryCount, bump, entries }
}

// Decode manifest (zero-copy format)
function decodeManifestMetadata(data) {
  const buffer = Buffer.from(data)
  let offset = 8 // Skip discriminator
  
  // Skip cartridge_id (32), zip_size (8), chunk_size (4), num_chunks (4), sha256 (32)
  offset += 32 + 8 + 4 + 4 + 32
  
  // Skip finalized (1) + padding (7)
  offset += 1 + 7
  
  // Skip created_slot (8), publisher (32)
  offset += 8 + 32
  
  // Read metadata_len (u16)
  const metadataLen = buffer.readUInt16LE(offset)
  offset += 2
  
  // Skip bump (1) + padding (5)
  offset += 1 + 5
  
  // Read metadata bytes
  if (metadataLen > 0 && metadataLen <= 256) {
    try {
      const metadataBytes = buffer.subarray(offset, offset + metadataLen)
      const metadataStr = new TextDecoder().decode(metadataBytes)
      return JSON.parse(metadataStr)
    } catch (e) {
      console.warn('Failed to parse manifest metadata:', e)
      return null
    }
  }
  return null
}

// Utility functions
function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function useSolanaCatalog(rpcEndpoint, showRetiredGames = null) {
  const loading = ref(false)
  const error = ref(null)
  const games = ref([])
  const rawEntries = ref([])

  // Rate limiter to prevent 429 errors
  // Testnet limits: 40 requests per 10 seconds per RPC endpoint
  const rateLimiter = createRateLimiter(40, 10000) // 40 requests per 10 seconds

  /**
   * Load catalog from Solana blockchain
   */
  async function loadCatalog() {
    if (!rpcEndpoint.value) {
      error.value = 'RPC endpoint not configured'
      return
    }

    loading.value = true
    error.value = null
    rawEntries.value = []
    games.value = []

    try {
      const connection = new Connection(rpcEndpoint.value, 'confirmed')

      // Fetch catalog root
      const [catalogRootPDA] = deriveCatalogRootPDA()
      const isCustom = isCustomRpcEndpoint(rpcEndpoint.value)
      if (!isCustom && rateLimiter._enabled) {
        await rateLimiter.rateLimit() // Rate limit before request
      }
      
      let rootInfo
      try {
        rootInfo = await connection.getAccountInfo(catalogRootPDA)
      } catch (err) {
        // Handle 429 errors with Retry-After
        if (err.message && (err.message.includes('429') || err.message.includes('Too Many Requests'))) {
          if (!isCustom) {
            rateLimiter.handle429Error(err)
            await new Promise(resolve => setTimeout(resolve, 1000))
            rootInfo = await connection.getAccountInfo(catalogRootPDA) // Retry once
          }
        } else {
          throw err
        }
      }

      if (!rootInfo) {
        error.value = 'Catalog not initialized on this network'
        loading.value = false
        return
      }

      const catalogRoot = decodeCatalogRoot(rootInfo.data)
      console.log(`Catalog found: ${catalogRoot.totalCartridges} cartridges in ${catalogRoot.pageCount} pages`)

      // Fetch all pages
      const entries = []
      for (let pageIdx = 0; pageIdx < catalogRoot.pageCount; pageIdx++) {
        const [pagePDA] = deriveCatalogPagePDA(pageIdx)
        if (!isCustom && rateLimiter._enabled) {
          await rateLimiter.rateLimit() // Rate limit before each page request
        }
        
        let pageInfo
        try {
          pageInfo = await connection.getAccountInfo(pagePDA)
        } catch (err) {
          // Handle 429 errors with Retry-After
          if (err.message && (err.message.includes('429') || err.message.includes('Too Many Requests'))) {
            if (!isCustom) {
              rateLimiter.handle429Error(err)
              await new Promise(resolve => setTimeout(resolve, 1000))
              pageInfo = await connection.getAccountInfo(pagePDA) // Retry once
            }
          } else {
            throw err
          }
        }
        
        if (pageInfo) {
          const page = decodeCatalogPage(pageInfo.data)
          entries.push(...page.entries)
        }
      }

      rawEntries.value = entries
      console.log(`Fetched ${entries.length} catalog entries`)

      // Flag constant for retired apps
      const FLAG_RETIRED = 0x01
      const shouldShowRetired = showRetiredGames?.value ?? false

      // Fetch manifests to get metadata (batch fetch for efficiency)
      const manifestPDAs = entries.map(entry => {
        const [pda] = deriveManifestPDA(entry.cartridgeId)
        return pda
      })
      
      // Fetch in batches of 100
      const manifestInfos = []
      for (let i = 0; i < manifestPDAs.length; i += 100) {
        const batch = manifestPDAs.slice(i, i + 100)
        if (!isCustom && rateLimiter._enabled) {
          await rateLimiter.rateLimit() // Rate limit before each batch request
        }
        
        let infos
        try {
          infos = await connection.getMultipleAccountsInfo(batch)
        } catch (err) {
          // Handle 429 errors with Retry-After
          if (err.message && (err.message.includes('429') || err.message.includes('Too Many Requests'))) {
            if (!isCustom) {
              rateLimiter.handle429Error(err)
              await new Promise(resolve => setTimeout(resolve, 1000))
              infos = await connection.getMultipleAccountsInfo(batch) // Retry once
            }
          } else {
            throw err
          }
        }
        manifestInfos.push(...infos)
      }

      // Convert entries to game format with metadata
      const gamesList = []

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        const isRetired = (entry.flags & FLAG_RETIRED) !== 0
        if (isRetired && !shouldShowRetired) continue

        const cartridgeIdHex = bytesToHex(entry.cartridgeId)
        
        // Skip ignored cartridges
        if (IGNORED_CARTRIDGE_HASHES.has(cartridgeIdHex.toLowerCase())) {
          console.log(`Skipping ignored cartridge: ${cartridgeIdHex}`)
          continue
        }
        
        // Try to get metadata from manifest
        let metadata = null
        if (manifestInfos[i]) {
          metadata = decodeManifestMetadata(manifestInfos[i].data)
        }
        
        // Use metadata for game info, fallback to defaults
        const title = metadata?.name || `Game ${cartridgeIdHex.substring(0, 8)}...`
        const platform = metadata?.platform || 'unknown'

        gamesList.push({
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

      games.value = gamesList
      console.log(`Loaded ${games.value.length} games with metadata`)

    } catch (err) {
      error.value = err.message || 'Failed to load catalog'
      console.error('Catalog loading error:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Get latest version of a game
   */
  function getLatestVersion(appId) {
    const game = games.value.find(g => g.appId === appId)
    return game && game.versions.length > 0 ? game.versions[0] : null
  }

  return {
    loading,
    error,
    games,
    rawEntries,
    loadCatalog,
    getLatestVersion
  }
}


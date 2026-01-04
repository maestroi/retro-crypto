/**
 * Sui + Walrus Protocol Driver
 * 
 * Implements the protocol driver interface for Sui blockchain with
 * Walrus decentralized blob storage.
 * 
 * Uses:
 * - Sui RPC for on-chain catalog/cartridge data
 * - Walrus aggregator for blob downloads
 * - WebCrypto for SHA256 verification
 * - JSZip for extraction
 */

import { verifySHA256, bytesToHex } from '../utils/payloads.js'
import { loadSuiWalrusConfig } from './suiWalrusConfig.js'

// Walrus Base58 alphabet (59 characters)
// Excludes: 0, O, I (zero, uppercase O, uppercase I)
// Includes lowercase 'l' unlike standard Bitcoin base58
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/**
 * Decode base58 string to bytes using Walrus alphabet
 * Uses big integer conversion to match Go's math/big behavior
 */
function base58Decode(s) {
  if (!s || s.length === 0) return new Uint8Array(0)
  
  // Convert to big integer (like Go's big.Int)
  let bigInt = BigInt(0)
  const radix = BigInt(59) // Must match alphabet length
  
  for (let i = 0; i < s.length; i++) {
    const char = s[i]
    const idx = BASE58_ALPHABET.indexOf(char)
    if (idx === -1) {
      throw new Error(`invalid base58 character: ${char}`)
    }
    bigInt = bigInt * radix + BigInt(idx)
  }
  
  // Convert big integer to bytes
  const bytes = []
  let num = bigInt
  while (num > 0n) {
    bytes.unshift(Number(num & 0xFFn))
    num = num >> 8n
  }
  
  // Handle leading zeros (character '1' in base58 = 0)
  const leadingZeros = s.split('').findIndex(c => c !== BASE58_ALPHABET[0])
  const leadingZeroCount = leadingZeros === -1 ? s.length : leadingZeros
  
  const result = new Uint8Array(leadingZeroCount + bytes.length)
  result.set(bytes, leadingZeroCount)
  
  return result
}

/**
 * Encode bytes to base58 string using Walrus alphabet
 */
function base58Encode(bytes) {
  if (!bytes || bytes.length === 0) return ''
  
  // Convert bytes to big integer
  let bigInt = BigInt(0)
  for (let i = 0; i < bytes.length; i++) {
    bigInt = bigInt * 256n + BigInt(bytes[i] & 0xFF)
  }
  
  // Count leading zeros
  let leadingZeros = 0
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) {
    leadingZeros++
  }
  
  // Encode (matching Go's DivMod logic)
  const result = []
  let num = bigInt
  const radix = BigInt(59) // Must match alphabet length
  while (num > 0n) {
    const mod = num % radix
    result.unshift(BASE58_ALPHABET[Number(mod)])
    num = num / radix  // BigInt division truncates automatically
  }
  
  // Add leading zeros (character '1' represents zero byte)
  for (let i = 0; i < leadingZeros; i++) {
    result.unshift(BASE58_ALPHABET[0])
  }
  
  return result.join('')
}

// Platform codes matching Move contract
const PLATFORMS = {
  0: 'DOS',
  1: 'GB',
  2: 'GBC',
  3: 'NES',
  4: 'SNES'
}

/**
 * Get platform name from code
 * @param {number} platformCode 
 * @returns {string}
 */
function getPlatformName(platformCode) {
  return PLATFORMS[platformCode] || 'DOS'
}

/**
 * Convert bytes array to hex string
 * @param {number[]} arr 
 * @returns {string}
 */
function bytesArrayToHex(arr) {
  if (!arr || !Array.isArray(arr)) return ''
  return arr.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Convert bytes array to base58 string (for Walrus blob IDs)
 * @param {number[]} arr 
 * @returns {string}
 */
function bytesArrayToBase58(arr) {
  if (!arr || !Array.isArray(arr)) return ''
  const bytes = Uint8Array.from(arr)
  return base58Encode(bytes)
}

/**
 * Sui RPC Client
 */
class SuiRPC {
  constructor(url) {
    this.url = url
    this.id = 1
    this.maxRetries = 3
    this.baseDelay = 1000
  }

  /**
   * Make JSON-RPC call to Sui
   */
  async call(method, params = []) {
    let lastError = null
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const request = {
          jsonrpc: '2.0',
          id: this.id++,
          method,
          params
        }

        // Create AbortController for timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

        try {
          const response = await fetch(this.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
            signal: controller.signal
          })

          clearTimeout(timeoutId)

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const data = await response.json()

          if (data.error) {
            throw new Error(`RPC error: ${data.error.message || JSON.stringify(data.error)}`)
          }

          return data.result
        } catch (fetchError) {
          clearTimeout(timeoutId)
          if (fetchError.name === 'AbortError') {
            throw new Error(`RPC call timed out after 30 seconds: ${method}`)
          }
          throw fetchError
        }
        
      } catch (error) {
        lastError = error
        console.error(`Sui RPC call error (${method}):`, error)
        if (attempt < this.maxRetries - 1) {
          const delay = this.baseDelay * Math.pow(2, attempt)
          console.warn(`Sui RPC call failed (attempt ${attempt + 1}/${this.maxRetries}), retrying in ${delay}ms...`)
          await new Promise(r => setTimeout(r, delay))
          continue
        }
        throw error
      }
    }
    
    throw lastError
  }

  /**
   * Get object by ID
   */
  async getObject(objectId, options = {}) {
    return this.call('sui_getObject', [
      objectId,
      {
        showContent: true,
        showOwner: true,
        ...options
      }
    ])
  }

  /**
   * Get dynamic fields of an object
   */
  async getDynamicFields(parentId, cursor = null, limit = 50) {
    return this.call('suix_getDynamicFields', [parentId, cursor, limit])
  }

  /**
   * Get a specific dynamic field object
   */
  async getDynamicFieldObject(parentId, name) {
    // The name parameter should be the full name object from getDynamicFields response
    // It can be either a string or an object with a type and value
    return this.call('suix_getDynamicFieldObject', [parentId, name])
  }
}

/**
 * Walrus Blob Client
 */
class WalrusClient {
  constructor(aggregatorUrl) {
    this.aggregatorUrl = aggregatorUrl
  }

  /**
   * Download a blob by ID with retry logic
   * @param {string} blobId - Walrus blob ID
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Promise<Uint8Array>}
   */
  async downloadBlob(blobId, maxRetries = 3) {
    let lastError = null
    const url = `${this.aggregatorUrl}/v1/blobs/${blobId}`

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url)
        
        if (!response.ok) {
          if (response.status === 404 || response.status === 400) {
            // Some base58 encodings are equivalent but Walrus only accepts the original
            // This can happen if the Go encoder produced a different encoding than Walrus expects
            // The bytes are correct, but the base58 string encoding differs
            throw new Error(`Blob not found (${response.status}). This is likely due to a base58 encoding mismatch. The blob ID stored in the contract uses a different base58 encoding than Walrus expects. Solution: Re-upload the game using the latest catalogctl version. Blob ID: ${blobId}`)
          }
          throw new Error(`Download failed: HTTP ${response.status}`)
        }

        const arrayBuffer = await response.arrayBuffer()
        return new Uint8Array(arrayBuffer)
        
      } catch (error) {
        lastError = error
        if (attempt < maxRetries - 1) {
          const delay = 1000 * Math.pow(2, attempt)
          console.warn(`Walrus download failed (attempt ${attempt + 1}/${maxRetries}), retrying...`)
          await new Promise(r => setTimeout(r, delay))
          continue
        }
      }
    }

    throw new Error(`Failed to download blob after ${maxRetries} attempts: ${lastError?.message}`)
  }
}

/**
 * Parse catalog object content from Sui response
 */
function parseCatalogObject(data) {
  if (!data || !data.content) return null
  
  const content = data.content
  const fields = content.fields || content
  
  return {
    id: data.objectId,
    owner: fields.owner || '',
    name: fields.name || '',
    description: fields.description || '',
    count: Number(fields.count) || 0
  }
}

/**
 * Parse catalog entry from dynamic field
 */
function parseCatalogEntry(slug, fieldData) {
  if (!fieldData || !fieldData.content) return null
  
  const content = fieldData.content
  const fields = content.fields || content
  const value = fields.value?.fields || fields.value || fields
  
  return {
    slug,
    cartridgeId: value.cartridge_id || '',
    title: value.title || '',
    platform: Number(value.platform) || 0,
    sizeBytes: Number(value.size_bytes) || 0,
    emulatorCore: value.emulator_core || '',
    version: Number(value.version) || 1,
    coverBlobId: bytesArrayToHex(value.cover_blob_id) || ''
  }
}

/**
 * Parse cartridge object content
 */
function parseCartridgeObject(data) {
  if (!data || !data.content) return null
  
  const content = data.content
  const fields = content.fields || content
  
    const blobIdBytes = fields.blob_id || []
    const blobId = bytesArrayToBase58(blobIdBytes)
    
    // Debug: log blob ID conversion
    if (blobIdBytes.length > 0) {
      console.log(`Blob ID bytes length: ${blobIdBytes.length}, base58: ${blobId}`)
    }
    
    return {
      id: data.objectId,
      slug: fields.slug || '',
      title: fields.title || '',
      platform: Number(fields.platform) || 0,
      emulatorCore: fields.emulator_core || '',
      version: Number(fields.version) || 1,
      blobId: blobId || '', // Convert to base58 for Walrus
      sha256: bytesArrayToHex(fields.sha256) || '',
      sizeBytes: Number(fields.size_bytes) || 0,
      publisher: fields.publisher || '',
      createdAtMs: Number(fields.created_at_ms) || 0
    }
}

/**
 * Create Sui + Walrus Protocol Driver
 * @param {string} rpcUrl - Sui RPC endpoint
 * @returns {Object} Protocol driver instance
 */
export function createSuiWalrusDriver(rpcUrl) {
  const config = loadSuiWalrusConfig()
  
  // Use Vite proxy in development to avoid CORS issues
  let effectiveRpcUrl = rpcUrl || config.suiRpcUrl
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    // In development, use Vite proxy
    if (effectiveRpcUrl.includes('fullnode.testnet.sui.io')) {
      effectiveRpcUrl = '/sui-rpc'
    }
  }
  
  const suiRpc = new SuiRPC(effectiveRpcUrl)
  const walrusClient = new WalrusClient(config.walrusAggregatorUrl)
  
  return {
    protocolId: 'sui',
    rpcUrl: rpcUrl || config.suiRpcUrl,
    walrusUrl: config.walrusAggregatorUrl,
    
    /**
     * Load catalog of games from Sui blockchain
     * @param {string} catalogId - Catalog object ID
     * @param {string|null} publisherAddress - Optional publisher filter (not used for Sui)
     * @param {Object|null} showRetiredRef - Ref to show retired flag
     * @returns {Promise<Object[]>} Array of games
     */
    async loadCatalog(catalogId, publisherAddress = null, showRetiredRef = null) {
      if (!catalogId || catalogId === 'custom') {
        throw new Error('Catalog ID is required')
      }

      console.log(`Loading Sui catalog: ${catalogId}`)

      // Get catalog object
      const catalogObj = await suiRpc.getObject(catalogId)
      if (!catalogObj.data) {
        throw new Error('Catalog not found')
      }
      
      const catalog = parseCatalogObject(catalogObj.data)
      console.log(`Catalog: ${catalog.name}, entries: ${catalog.count}`)

      // Enumerate dynamic fields to get all entries
      const entries = []
      let cursor = null
      let previousCursor = null
      
      do {
        const fieldsResponse = await suiRpc.getDynamicFields(catalogId, cursor, 50)
        const fields = fieldsResponse.data || []
        
        for (const field of fields) {
          // Get the dynamic field value
          try {
            const fieldObj = await suiRpc.getDynamicFieldObject(catalogId, field.name)
            
            if (fieldObj.data) {
              // Extract slug from field name
              const slug = field.name?.value || field.name || ''
              const entry = parseCatalogEntry(slug, fieldObj.data)
              
              if (entry) {
                entries.push(entry)
              }
            }
          } catch (err) {
            console.error(`Error processing field ${field.name}:`, err)
            throw err
          }
        }
        
        // Check next cursor before updating
        const nextCursor = fieldsResponse.nextCursor
        
        // Stop if:
        // 1. No next cursor (null or undefined)
        // 2. Cursor hasn't changed (infinite loop protection)
        // 3. No fields returned and no next cursor
        if (!nextCursor || nextCursor === cursor || (fields.length === 0 && !nextCursor)) {
          break
        }
        
        previousCursor = cursor
        cursor = nextCursor
      } while (true)

      console.log(`Loaded ${entries.length} catalog entries`)

      // Convert to game format matching existing driver pattern
      const games = entries.map(entry => ({
        appId: entry.cartridgeId,
        title: entry.title,
        platform: getPlatformName(entry.platform),
        retired: false,
        versions: [{
          semver: {
            major: Math.floor(entry.version / 100),
            minor: Math.floor((entry.version % 100) / 10),
            patch: entry.version % 10,
            string: `${Math.floor(entry.version / 100)}.${Math.floor((entry.version % 100) / 10)}.${entry.version % 10}`
          },
          cartridgeAddress: entry.cartridgeId,
          slug: entry.slug,
          sizeBytes: entry.sizeBytes,
          emulatorCore: entry.emulatorCore
        }]
      }))

      return games
    },

    /**
     * Load cartridge info (metadata only, no download)
     * @param {string} cartridgeId - Cartridge object ID
     * @returns {Promise<Object|null>}
     */
    async loadCartridgeInfo(cartridgeId) {
      if (!cartridgeId) {
        throw new Error('Cartridge ID is required')
      }

      const cartObj = await suiRpc.getObject(cartridgeId)
      if (!cartObj.data) {
        return null
      }

      const cart = parseCartridgeObject(cartObj.data)
      if (!cart) return null

      return {
        cartridgeId: cart.id,
        totalSize: cart.sizeBytes,
        sha256: cart.sha256,
        platform: getPlatformName(cart.platform),
        blobId: cart.blobId,
        version: cart.version,
        emulatorCore: cart.emulatorCore,
        publisher: cart.publisher,
        slug: cart.slug,
        title: cart.title,
        // Match existing header format
        chunkSize: cart.sizeBytes, // No chunking with Walrus
        numChunks: 1
      }
    },

    /**
     * Load full cartridge (download from Walrus and verify)
     * @param {string} cartridgeId - Cartridge object ID
     * @param {string|null} publisherAddress - Not used for Sui
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<{fileData: Uint8Array, verified: boolean, cartHeader: Object}>}
     */
    async loadCartridge(cartridgeId, publisherAddress = null, onProgress = () => {}) {
      // Get cartridge info first
      const cartHeader = await this.loadCartridgeInfo(cartridgeId)
      if (!cartHeader) {
        throw new Error('Cartridge not found')
      }

      if (!cartHeader.blobId) {
        throw new Error('Cartridge has no blob ID')
      }

      console.log(`Downloading blob from Walrus: ${cartHeader.blobId}`)
      console.log(`Blob ID length: ${cartHeader.blobId.length}, format: base58`)

      const startTime = Date.now()

      // Report download start
      onProgress({
        chunksFound: 0,
        expectedChunks: 1,
        bytes: 0,
        rate: 0,
        phase: 'downloading',
        statusMessage: 'Downloading from Walrus...'
      })

      // Download from Walrus
      let fileData
      try {
        fileData = await walrusClient.downloadBlob(cartHeader.blobId)
      } catch (err) {
        onProgress({
          chunksFound: 0,
          expectedChunks: 1,
          bytes: 0,
          rate: 0,
          phase: 'error',
          statusMessage: `Download failed: ${err.message}`
        })
        throw err
      }

      onProgress({
        chunksFound: 1,
        expectedChunks: 1,
        bytes: fileData.length,
        rate: fileData.length / ((Date.now() - startTime) / 1000),
        phase: 'verifying',
        statusMessage: 'Verifying SHA256...'
      })

      // Verify SHA256
      const isValid = await verifySHA256(fileData, cartHeader.sha256)

      if (!isValid) {
        onProgress({
          chunksFound: 1,
          expectedChunks: 1,
          bytes: fileData.length,
          rate: 0,
          phase: 'error',
          statusMessage: 'SHA256 verification failed!'
        })
        throw new Error(`SHA256 verification failed! Expected ${cartHeader.sha256}`)
      }

      onProgress({
        chunksFound: 1,
        expectedChunks: 1,
        bytes: fileData.length,
        rate: 0,
        phase: 'complete',
        statusMessage: 'Download complete'
      })

      return {
        fileData,
        verified: true,
        cartHeader
      }
    }
  }
}


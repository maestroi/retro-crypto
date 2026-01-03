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

        const response = await fetch(this.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request)
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()

        if (data.error) {
          throw new Error(`RPC error: ${data.error.message || JSON.stringify(data.error)}`)
        }

        return data.result
        
      } catch (error) {
        lastError = error
        if (attempt < this.maxRetries - 1) {
          const delay = this.baseDelay * Math.pow(2, attempt)
          console.warn(`Sui RPC call failed (attempt ${attempt + 1}/${this.maxRetries}), retrying...`)
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
    const url = `${this.aggregatorUrl}/v1/${blobId}`
    let lastError = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url)
        
        if (!response.ok) {
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
  
  return {
    id: data.objectId,
    slug: fields.slug || '',
    title: fields.title || '',
    platform: Number(fields.platform) || 0,
    emulatorCore: fields.emulator_core || '',
    version: Number(fields.version) || 1,
    blobId: bytesArrayToHex(fields.blob_id) || '',
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
  const suiRpc = new SuiRPC(rpcUrl || config.suiRpcUrl)
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
      
      do {
        const fieldsResponse = await suiRpc.getDynamicFields(catalogId, cursor, 50)
        
        for (const field of fieldsResponse.data || []) {
          // Get the dynamic field value
          const fieldObj = await suiRpc.getDynamicFieldObject(catalogId, field.name)
          
          if (fieldObj.data) {
            // Extract slug from field name
            const slug = field.name?.value || field.name || ''
            const entry = parseCatalogEntry(slug, fieldObj.data)
            
            if (entry) {
              entries.push(entry)
            }
          }
        }
        
        cursor = fieldsResponse.nextCursor
      } while (cursor)

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


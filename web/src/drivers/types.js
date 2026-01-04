/**
 * Protocol Driver Interface
 * 
 * All protocol drivers must implement this interface to provide a consistent
 * way to interact with different blockchain storage protocols (Nimiq, Solana, etc.)
 * 
 * The driver system allows the app to:
 * - Switch between protocols seamlessly
 * - Add new protocol support by implementing this interface
 * - Share common UI components across all protocols
 */

import { SUI_WALRUS_PROTOCOL_CONFIG } from './suiWalrusConfig.js'

/**
 * @typedef {Object} Game
 * @property {string|number} appId - Unique identifier for the app/game
 * @property {string} title - Display title
 * @property {string} platform - Platform code (DOS, GB, GBC, NES)
 * @property {string} [description] - Optional description
 * @property {string} [publisher] - Optional publisher name
 * @property {string} [year] - Optional year
 * @property {boolean} retired - Whether the game is retired
 * @property {GameVersion[]} versions - Array of available versions
 */

/**
 * @typedef {Object} GameVersion
 * @property {Semver} semver - Semantic version
 * @property {string} cartridgeAddress - Address/ID to fetch cartridge
 * @property {number} [flags] - Optional flags
 * @property {string} [txHash] - Optional transaction hash
 * @property {number} [height] - Optional block height
 */

/**
 * @typedef {Object} Semver
 * @property {number} major
 * @property {number} minor
 * @property {number} patch
 * @property {string} string - Formatted version string (e.g., "1.0.0")
 */

/**
 * @typedef {Object} CartridgeHeader
 * @property {string|number} cartridgeId - Cartridge identifier
 * @property {number} totalSize - Total size in bytes
 * @property {number} chunkSize - Size of each chunk
 * @property {number} [numChunks] - Number of chunks
 * @property {string} sha256 - SHA256 hash of the file
 * @property {number|string} platform - Platform code
 * @property {boolean} [finalized] - Whether the cartridge is finalized (Solana)
 * @property {string} [publisher] - Publisher address
 * @property {boolean} [publisherVerified] - Whether publisher is verified
 * @property {Object} [metadata] - Additional metadata
 */

/**
 * @typedef {Object} Progress
 * @property {number} chunksFound - Number of chunks downloaded
 * @property {number} expectedChunks - Total expected chunks
 * @property {number} bytes - Bytes downloaded
 * @property {number} rate - Download rate (chunks/second)
 * @property {string} phase - Current phase (idle, fetching-txs, parsing-chunks, reconstructing, verifying)
 * @property {string} statusMessage - Human-readable status
 * @property {number} [txPagesFetched] - Pages fetched (Nimiq)
 * @property {number} [txTotalFetched] - Total transactions fetched (Nimiq)
 */

/**
 * @typedef {Object} RpcEndpoint
 * @property {string} name - Display name
 * @property {string} url - RPC URL or 'custom' for user-provided
 */

/**
 * @typedef {Object} Catalog
 * @property {string} name - Display name
 * @property {string} address - Catalog address or identifier
 * @property {boolean} [devOnly] - Only show in developer mode
 */

/**
 * @typedef {Object} ProtocolConfig
 * @property {string} id - Protocol identifier (nimiq, solana)
 * @property {string} name - Display name
 * @property {string} icon - Emoji icon
 * @property {string} color - Tailwind color class
 * @property {RpcEndpoint[]} rpcEndpoints - Available RPC endpoints
 * @property {Catalog[]} catalogs - Available catalogs
 * @property {string} defaultRpc - Default RPC URL
 * @property {string} defaultCatalog - Default catalog name
 */

/**
 * Protocol Driver Interface
 * @interface ProtocolDriver
 */

/**
 * Create a protocol driver instance
 * @callback CreateDriver
 * @param {string} rpcUrl - RPC endpoint URL
 * @returns {ProtocolDriver}
 */

/**
 * @typedef {Object} ProtocolDriver
 * @property {string} protocolId - Protocol identifier
 * @property {string} rpcUrl - Current RPC URL
 * 
 * @property {function(string, string?, import('vue').Ref<boolean>?): Promise<Game[]>} loadCatalog
 *   Load catalog of games
 *   @param {string} catalogAddress - Catalog address/identifier
 *   @param {string} [publisherAddress] - Optional publisher filter
 *   @param {import('vue').Ref<boolean>} [showRetired] - Whether to show retired games
 *   @returns {Promise<Game[]>}
 * 
 * @property {function(string): Promise<CartridgeHeader|null>} loadCartridgeInfo
 *   Load cartridge header/manifest without downloading data
 *   @param {string} cartridgeAddress - Cartridge address/ID
 *   @returns {Promise<CartridgeHeader|null>}
 * 
 * @property {function(string, function(Progress): void): Promise<{fileData: Uint8Array, verified: boolean}>} loadCartridge
 *   Download and verify full cartridge
 *   @param {string} cartridgeAddress - Cartridge address/ID
 *   @param {function(Progress): void} onProgress - Progress callback
 *   @returns {Promise<{fileData: Uint8Array, verified: boolean}>}
 */

export const PROTOCOL_CONFIGS = {
  nimiq: {
    id: 'nimiq',
    name: 'Nimiq',
    icon: '🟡',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    rpcEndpoints: [
      { name: 'NimiqScan Mainnet', url: 'https://rpc-mainnet.nimiqscan.com' },
      { name: 'Custom...', url: 'custom' }
    ],
    catalogs: [
      { name: 'Test', address: 'NQ32 0VD4 26TR 1394 KXBJ 862C NFKG 61M5 GFJ0', devOnly: true },
      { name: 'Main', address: 'NQ15 NXMP 11A0 TMKP G1Q8 4ABD U16C XD6Q D948' },
      { name: 'Custom...', address: 'custom' }
    ],
    defaultRpc: 'https://rpc-mainnet.nimiqscan.com',
    defaultCatalog: 'Main',
    publisherAddress: 'NQ89 4GDH 0J4U C2FY TU0Y TP1X J1H7 3HX3 PVSE'
  },
  solana: {
    id: 'solana',
    name: 'Solana',
    icon: '🟣',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    rpcEndpoints: [
      { name: 'Solana Retro Proxy (Recommended)', url: 'https://rpc-solana-retro.maestroi.cc' },
      { name: 'Solana Local Proxy', url: 'http://localhost:8899' },
      { name: 'Solana Testnet (Rate Limited)', url: 'https://api.testnet.solana.com' },
      { name: 'Custom...', url: 'custom' }
    ],
    catalogs: [
      { name: 'Testnet', address: 'testnet' },
      { name: 'Custom...', address: 'custom' }
    ],
    defaultRpc: 'https://rpc-solana-retro.maestroi.cc',
    defaultCatalog: 'Testnet',
    publisherAddress: ''
  },
  sui: (() => {
    // Use config from suiWalrusConfig.js which supports environment variables
    // Normalize catalogs to use 'address' property for consistency
    const suiConfig = SUI_WALRUS_PROTOCOL_CONFIG
    return {
      ...suiConfig,
      catalogs: suiConfig.catalogs.map(cat => ({
        ...cat,
        address: cat.catalogId || cat.address || ''
      }))
    }
  })()
}

/**
 * Get protocol display info
 * @param {string} protocolId
 * @returns {ProtocolConfig}
 */
export function getProtocolConfig(protocolId) {
  return PROTOCOL_CONFIGS[protocolId] || PROTOCOL_CONFIGS.nimiq
}

/**
 * Get all available protocols
 * @returns {ProtocolConfig[]}
 */
export function getAllProtocols() {
  return Object.values(PROTOCOL_CONFIGS)
}


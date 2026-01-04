/**
 * Protocol Driver Factory
 * 
 * Creates the appropriate driver instance based on protocol ID.
 */

import { createNimiqDriver } from './nimiq.js'
import { createSolanaDriver } from './solana.js'
import { createSuiWalrusDriver } from './suiWalrus.js'
import { PROTOCOL_CONFIGS, getProtocolConfig, getAllProtocols } from './types.js'

/**
 * Create a protocol driver instance
 * @param {string} protocolId - Protocol identifier (nimiq, solana, sui)
 * @param {string} rpcUrl - RPC endpoint URL
 * @returns {ProtocolDriver}
 */
export function createDriver(protocolId, rpcUrl) {
  switch (protocolId) {
    case 'nimiq':
      return createNimiqDriver(rpcUrl)
    case 'solana':
      return createSolanaDriver(rpcUrl)
    case 'sui':
      return createSuiWalrusDriver(rpcUrl)
    default:
      throw new Error(`Unknown protocol: ${protocolId}`)
  }
}

/**
 * Get default RPC URL for a protocol
 * @param {string} protocolId
 * @returns {string}
 */
export function getDefaultRpcUrl(protocolId) {
  const config = getProtocolConfig(protocolId)
  return config?.defaultRpc || ''
}

/**
 * Get default catalog for a protocol
 * @param {string} protocolId
 * @returns {string}
 */
export function getDefaultCatalog(protocolId) {
  const config = getProtocolConfig(protocolId)
  return config?.defaultCatalog || ''
}

export { PROTOCOL_CONFIGS, getProtocolConfig, getAllProtocols }


import { PublicKey } from '@solana/web3.js'

/**
 * Ignored cartridge hashes - these will be filtered out from the catalog
 * and prevented from loading in the frontend
 * Used to prevent duplicate or unwanted cartridges from being displayed
 */
export const IGNORED_CARTRIDGE_HASHES = new Set([
  '3ad4d86d6576ae358b29ca8b1a5c7fcf56723846e900628a1c9d54fa081be12d',
  'f9105991050e12e268c3e0b7fcda54d9dd2469073d60e71809fc1446e7cf5caa',
  'd9e861c1f9eff8ead43195b4cc89dea3a9cf181de39f1c02ef1e68cdb7e409e5', // NES test game (not actually a game)
])

/**
 * Program ID for the cartridge storage program
 * This should match the declared ID in the Anchor program
 */
export const PROGRAM_ID = new PublicKey('iXBRbJjLtohupYmSDz3diKTVz2wU8NXe4gezFsSNcy1')

/**
 * PDA Seeds
 */
export const CATALOG_ROOT_SEED = Buffer.from('catalog_root')
export const CATALOG_PAGE_SEED = Buffer.from('catalog_page')
export const MANIFEST_SEED = Buffer.from('manifest')
export const CHUNK_SEED = Buffer.from('chunk')

/**
 * Maximum cartridge size (6MB)
 */
export const MAX_CARTRIDGE_SIZE = 6 * 1024 * 1024

/**
 * Default chunk size (800 bytes) - must fit within Solana transaction limits
 */
export const DEFAULT_CHUNK_SIZE = 800

/**
 * Entries per catalog page - matches Rust program
 */
export const ENTRIES_PER_PAGE = 16

/**
 * Network endpoints
 */
export const ENDPOINTS = {
  mainnet: 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
  localnet: 'http://localhost:8899',
}

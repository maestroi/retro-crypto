/**
 * Sui/Walrus Driver Configuration
 * 
 * Reads configuration from environment variables and provides
 * catalog IDs for different game collections.
 */

/**
 * @typedef {Object} SuiWalrusCatalog
 * @property {string} name - Display name
 * @property {string} catalogId - Catalog object ID on Sui
 * @property {string} [platform] - Primary platform focus (optional)
 * @property {string} [description] - Description
 * @property {boolean} [devOnly] - Only show in developer mode
 */

// Default configuration for Sui testnet
const DEFAULT_SUI_RPC_TESTNET = 'https://fullnode.testnet.sui.io:443'
const DEFAULT_WALRUS_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space'

/**
 * Get environment variable with fallback
 * @param {string} key 
 * @param {string} defaultValue 
 * @returns {string}
 */
function getEnvVar(key, defaultValue = '') {
  // Check Vite env vars
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const viteKey = `VITE_${key}`
    if (import.meta.env[viteKey]) {
      return import.meta.env[viteKey]
    }
  }
  return defaultValue
}

/**
 * Parse catalog configs from environment or use defaults
 * @returns {SuiWalrusCatalog[]}
 */
function parseCatalogConfigs() {
  const catalogsJson = getEnvVar('SUI_CATALOGS', '')
  
  if (catalogsJson) {
    try {
      return JSON.parse(catalogsJson)
    } catch (e) {
      console.warn('Failed to parse SUI_CATALOGS env var:', e)
    }
  }
  
  // Default catalogs - these would be populated after deployment
  const defaultCatalogId = getEnvVar('SUI_CATALOG_ID', '')
  
  return [
    {
      name: 'Testnet Games',
      catalogId: defaultCatalogId,
      platform: 'mixed',
      description: 'Test games on Sui testnet',
    },
    {
      name: 'Custom...',
      catalogId: 'custom',
      description: 'Enter a custom catalog ID',
    }
  ]
}

/**
 * Load Sui/Walrus configuration
 * @returns {{suiRpcUrl: string, walrusAggregatorUrl: string, packageId: string, registryId: string, catalogs: SuiWalrusCatalog[]}}
 */
export function loadSuiWalrusConfig() {
  return {
    suiRpcUrl: getEnvVar('SUI_RPC_URL', DEFAULT_SUI_RPC_TESTNET),
    walrusAggregatorUrl: getEnvVar('WALRUS_AGGREGATOR_URL', DEFAULT_WALRUS_AGGREGATOR),
    packageId: getEnvVar('SUI_PACKAGE_ID', ''),
    registryId: getEnvVar('SUI_REGISTRY_ID', ''),
    catalogs: parseCatalogConfigs(),
  }
}

/**
 * Configuration for protocol selector integration
 * Matches the pattern used in types.js PROTOCOL_CONFIGS
 */
export const SUI_WALRUS_PROTOCOL_CONFIG = {
  id: 'sui',
  name: 'Sui + Walrus',
  icon: '🔵',
  color: 'text-blue-400',
  bgColor: 'bg-blue-400/10',
  rpcEndpoints: [
    { name: 'Sui Testnet', url: DEFAULT_SUI_RPC_TESTNET },
    { name: 'Sui Devnet', url: 'https://fullnode.devnet.sui.io:443' },
    { name: 'Sui Mainnet', url: 'https://fullnode.mainnet.sui.io:443' },
    { name: 'Custom...', url: 'custom' },
  ],
  catalogs: parseCatalogConfigs(),
  defaultRpc: DEFAULT_SUI_RPC_TESTNET,
  defaultCatalog: 'Testnet Games',
  publisherAddress: '',
  walrusAggregatorUrl: DEFAULT_WALRUS_AGGREGATOR,
}


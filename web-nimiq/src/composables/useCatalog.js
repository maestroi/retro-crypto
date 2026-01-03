import { ref, computed } from 'vue'
import { parseCENT, hexToBytes, normalizeAddress } from '../utils/payloads.js'

/**
 * Catalog loader composable
 * Fetches transactions from CATALOG_ADDRESS and parses CENT entries
 */
export function useCatalog(rpcClient, catalogAddress, publisherAddress, showRetiredGames = null) {
  const loading = ref(false)
  const error = ref(null)
  const games = ref([]) // Array of { appId, title, platform, versions: [...] }
  const rawEntries = ref([]) // All CENT entries

  /**
   * Load catalog from blockchain
   */
  async function loadCatalog() {
    if (!catalogAddress.value || !rpcClient.value) {
      error.value = 'Catalog address or RPC client not configured'
      return
    }

    loading.value = true
    error.value = null
    rawEntries.value = []
    games.value = []

    try {
      // Fetch all transactions from catalog address
      const transactions = await rpcClient.value.getAllTransactionsByAddress(
        catalogAddress.value,
        500,
        (progress) => {
          console.log(`Loading catalog: page ${progress.page}, ${progress.totalFetched} entries`)
        }
      )

      console.log(`Fetched ${transactions.length} transactions from catalog address`)

      // Filter by publisher and parse CENT entries
      const entries = []
      const normalizedPublisher = publisherAddress.value ? normalizeAddress(publisherAddress.value) : null
      
      for (const tx of transactions) {
        // Check publisher (normalize both addresses for comparison)
        if (normalizedPublisher && normalizeAddress(tx.from) !== normalizedPublisher) {
          continue
        }

        // Parse transaction data
        const txData = tx.recipientData || tx.data || ''
        if (!txData) continue

        try {
          const data = hexToBytes(txData)
          const cent = parseCENT(data)
          
          if (cent) {
            entries.push({
              ...cent,
              txHash: tx.hash,
              height: tx.height,
              blockNumber: tx.blockNumber
            })
          }
        } catch (err) {
          console.warn(`Failed to parse CENT from tx ${tx.hash}:`, err)
        }
      }

      rawEntries.value = entries
      console.log(`Parsed ${entries.length} CENT entries`)

      // Flag constant for retired apps (matches Go: FlagRetired = 0x01)
      const FLAG_RETIRED = 0x01
      
      // First, identify which app-ids are retired (if ANY version has retired flag, entire app is retired)
      const retiredAppIds = new Set()
      for (const entry of entries) {
        if (entry.flags & FLAG_RETIRED) {
          retiredAppIds.add(entry.appId)
          console.log(`Found retired app-id: ${entry.appId} (flags: 0x${entry.flags.toString(16)})`)
        }
      }
      
      // Group by app_id and sort versions (optionally excluding retired apps)
      const gamesMap = new Map()
      const shouldShowRetired = showRetiredGames?.value ?? false
      
      for (const entry of entries) {
        // Skip entire app if it's retired (unless showRetiredGames is enabled)
        if (retiredAppIds.has(entry.appId) && !shouldShowRetired) {
          continue
        }
        
        if (!gamesMap.has(entry.appId)) {
          gamesMap.set(entry.appId, {
            appId: entry.appId,
            title: entry.title || `App ${entry.appId}`,
            platform: getPlatformName(entry.platform),
            retired: retiredAppIds.has(entry.appId),
            versions: []
          })
        }
        
        const game = gamesMap.get(entry.appId)
        game.versions.push({
          semver: entry.semver,
          cartridgeAddress: entry.cartridgeAddress,
          flags: entry.flags,
          txHash: entry.txHash,
          height: entry.height,
          blockNumber: entry.blockNumber
        })
      }

      // Sort versions by semver (newest first) and then by height
      for (const game of gamesMap.values()) {
        game.versions.sort((a, b) => {
          // Compare semver
          if (a.semver.major !== b.semver.major) {
            return b.semver.major - a.semver.major
          }
          if (a.semver.minor !== b.semver.minor) {
            return b.semver.minor - a.semver.minor
          }
          if (a.semver.patch !== b.semver.patch) {
            return b.semver.patch - a.semver.patch
          }
          // If semver is equal, use height (newer = higher)
          return b.height - a.height
        })
      }

      games.value = Array.from(gamesMap.values())
      games.value.sort((a, b) => {
        // Sort games by app_id (descending - newest first)
        return b.appId - a.appId
      })

      console.log(`Grouped into ${games.value.length} games`)
    } catch (err) {
      error.value = err.message || 'Failed to load catalog'
      console.error('Catalog loading error:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Get platform name from platform code
   */
  function getPlatformName(platformCode) {
    const platforms = {
      0: 'DOS',
      1: 'GB',
      2: 'GBC',
      3: 'NES'
    }
    return platforms[platformCode] || `Platform ${platformCode}`
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


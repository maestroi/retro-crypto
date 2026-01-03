import { ref, watch } from 'vue'

const STORAGE_KEY = 'nimiq-doom-recently-played'
const MAX_RECENT_GAMES = 5

/**
 * Recently Played composable
 * Tracks recently played games in localStorage
 */
export function useRecentlyPlayed() {
  const recentGames = ref([])

  // Load from localStorage
  function loadRecentGames() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        recentGames.value = JSON.parse(stored)
      }
    } catch (err) {
      console.warn('Failed to load recently played games:', err)
      recentGames.value = []
    }
  }

  // Save to localStorage
  function saveRecentGames() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recentGames.value))
    } catch (err) {
      console.warn('Failed to save recently played games:', err)
    }
  }

  /**
   * Add a game to recently played
   * @param {Object} game - Game object with appId, title, platform, cartridgeAddress
   */
  function addRecentGame(game) {
    if (!game || !game.appId) return

    const entry = {
      appId: game.appId,
      title: game.title,
      platform: game.platform,
      cartridgeAddress: game.cartridgeAddress,
      version: game.version,
      lastPlayed: Date.now()
    }

    // Remove existing entry for same game
    recentGames.value = recentGames.value.filter(g => g.appId !== game.appId)

    // Add to beginning
    recentGames.value.unshift(entry)

    // Keep only last N games
    recentGames.value = recentGames.value.slice(0, MAX_RECENT_GAMES)

    saveRecentGames()
  }

  /**
   * Remove a game from recently played
   */
  function removeRecentGame(appId) {
    recentGames.value = recentGames.value.filter(g => g.appId !== appId)
    saveRecentGames()
  }

  /**
   * Clear all recently played
   */
  function clearRecentGames() {
    recentGames.value = []
    saveRecentGames()
  }

  /**
   * Format time since last played
   */
  function formatLastPlayed(timestamp) {
    const now = Date.now()
    const diff = now - timestamp
    
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    
    return new Date(timestamp).toLocaleDateString()
  }

  // Load on initialization
  loadRecentGames()

  return {
    recentGames,
    addRecentGame,
    removeRecentGame,
    clearRecentGames,
    formatLastPlayed
  }
}


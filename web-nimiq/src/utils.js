export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

export function formatHash(hash) {
  if (!hash) return ''
  // Show first 8 and last 8 characters with ellipsis in between
  if (hash.length > 20) {
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`
  }
  return hash
}

export function formatAddress(address) {
  if (!address) return ''
  // Show first 8 and last 8 characters with ellipsis in between
  if (address.length > 20) {
    return `${address.substring(0, 8)}...${address.substring(address.length - 8)}`
  }
  return address
}

export function formatTimeRemaining(seconds) {
  if (!seconds || !isFinite(seconds)) return 'Calculating...'
  
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}m ${secs}s`
  } else {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${mins}m`
  }
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} - Success status
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      return true
    } catch (fallbackErr) {
      console.error('Failed to copy to clipboard:', fallbackErr)
      return false
    }
  }
}

/**
 * Estimate download time based on chunk rate
 * @param {number} remainingChunks - Number of chunks remaining
 * @param {number} rate - Chunks per second
 * @returns {string} - Formatted time estimate
 */
export function estimateDownloadTime(remainingChunks, rate) {
  if (!remainingChunks || !rate || rate <= 0) return null
  const seconds = remainingChunks / rate
  return formatTimeRemaining(seconds)
}

/**
 * Format Nimiq address with spaces for readability
 * @param {string} address - Nimiq address (NQ...)
 * @returns {string} - Formatted address with spaces
 */
export function formatNimiqAddress(address) {
  if (!address) return ''
  // Remove existing spaces
  const clean = address.replace(/\s/g, '')
  // Add space every 4 characters after NQ
  if (clean.startsWith('NQ') && clean.length >= 36) {
    return clean.slice(0, 4) + ' ' + clean.slice(4).match(/.{1,4}/g).join(' ')
  }
  return address
}

/**
 * Get platform display info
 * @param {string|number} platform - Platform code or name
 * @returns {Object} - { name, icon, color }
 */
export function getPlatformInfo(platform) {
  const platforms = {
    0: { name: 'DOS', icon: '💾', color: 'text-blue-400', bg: 'bg-blue-400/10' },
    1: { name: 'GB', icon: '🎮', color: 'text-green-400', bg: 'bg-green-400/10' },
    2: { name: 'GBC', icon: '🎨', color: 'text-purple-400', bg: 'bg-purple-400/10' },
    3: { name: 'NES', icon: '🕹️', color: 'text-red-400', bg: 'bg-red-400/10' },
    'DOS': { name: 'DOS', icon: '💾', color: 'text-blue-400', bg: 'bg-blue-400/10' },
    'GB': { name: 'GB', icon: '🎮', color: 'text-green-400', bg: 'bg-green-400/10' },
    'GBC': { name: 'GBC', icon: '🎨', color: 'text-purple-400', bg: 'bg-purple-400/10' },
    'NES': { name: 'NES', icon: '🕹️', color: 'text-red-400', bg: 'bg-red-400/10' },
  }
  return platforms[platform] || { name: String(platform), icon: '🎮', color: 'text-gray-400', bg: 'bg-gray-400/10' }
}

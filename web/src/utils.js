/**
 * Utility functions
 */

export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

export function formatHash(hash) {
  if (!hash) return ''
  if (hash.length > 20) {
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`
  }
  return hash
}

export function formatAddress(address) {
  if (!address) return ''
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

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
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

export function estimateDownloadTime(remainingChunks, rate) {
  if (!remainingChunks || !rate || rate <= 0) return null
  const seconds = remainingChunks / rate
  return formatTimeRemaining(seconds)
}

export function formatNimiqAddress(address) {
  if (!address) return ''
  const clean = address.replace(/\s/g, '')
  if (clean.startsWith('NQ') && clean.length >= 36) {
    return clean.slice(0, 4) + ' ' + clean.slice(4).match(/.{1,4}/g).join(' ')
  }
  return address
}

export function getPlatformInfo(platform) {
  const p = typeof platform === 'string' ? platform.toUpperCase() : platform
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
  return platforms[p] || { name: String(platform), icon: '🎮', color: 'text-gray-400', bg: 'bg-gray-400/10' }
}


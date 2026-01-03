import { ref, onMounted, onUnmounted } from 'vue'

/**
 * Keyboard shortcuts composable
 * Provides global keyboard shortcuts for emulator controls
 * 
 * Uses capture phase to intercept events before they reach iframes
 */
export function useKeyboardShortcuts(options = {}) {
  const {
    onFullscreen = null,
    onReset = null,
    onPause = null,
    onSaveState = null,
    onLoadState = null,
    onMute = null,
    enabled = ref(true)
  } = options

  const shortcuts = ref([
    { key: 'F11', description: 'Toggle Fullscreen', action: 'fullscreen', alwaysEnabled: true },
    { key: 'Escape', description: 'Exit Fullscreen', action: 'exitFullscreen', alwaysEnabled: true },
    { key: 'R', description: 'Reset Game', action: 'reset', requiresCtrl: true },
    { key: 'P', description: 'Pause/Resume', action: 'pause' },
    { key: 'M', description: 'Mute/Unmute', action: 'mute' },
  ])

  const isFullscreen = ref(false)
  const isPaused = ref(false)
  const isMuted = ref(false)
  const lastAction = ref(null) // For showing feedback
  const isActive = ref(false) // Track if shortcuts are listening

  function showActionFeedback(action) {
    lastAction.value = action
    setTimeout(() => {
      lastAction.value = null
    }, 1500)
  }

  function handleKeyDown(event) {
    // Don't trigger if typing in an input (check both target and active element)
    const activeEl = document.activeElement
    const targetTag = event.target?.tagName?.toUpperCase()
    const activeTag = activeEl?.tagName?.toUpperCase()
    
    if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT' ||
        activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
      return
    }

    const key = event.key

    // F11 - Toggle Fullscreen (always enabled)
    if (key === 'F11') {
      event.preventDefault()
      event.stopPropagation()
      toggleFullscreen()
      return
    }

    // Escape - Exit Fullscreen (always enabled)
    if (key === 'Escape') {
      if (document.fullscreenElement) {
        event.preventDefault()
        event.stopPropagation()
        document.exitFullscreen()
        isFullscreen.value = false
        showActionFeedback('Exit Fullscreen')
      }
      return
    }

    // Check if other shortcuts are enabled (requires game running)
    if (!enabled.value) return

    // Ctrl+R - Reset (prevent browser refresh)
    if (key.toLowerCase() === 'r' && event.ctrlKey) {
      event.preventDefault()
      event.stopPropagation()
      if (onReset) {
        onReset()
        showActionFeedback('🔄 Resetting...')
      }
      return
    }

    // P - Pause/Resume (not implemented for iframe emulators, but show feedback)
    if (key.toLowerCase() === 'p' && !event.ctrlKey && !event.altKey) {
      event.preventDefault()
      event.stopPropagation()
      isPaused.value = !isPaused.value
      if (onPause) {
        onPause(isPaused.value)
      }
      showActionFeedback(isPaused.value ? '⏸️ Paused' : '▶️ Resumed')
      return
    }

    // M - Mute/Unmute
    if (key.toLowerCase() === 'm' && !event.ctrlKey && !event.altKey) {
      event.preventDefault()
      event.stopPropagation()
      isMuted.value = !isMuted.value
      if (onMute) {
        onMute(isMuted.value)
      }
      showActionFeedback(isMuted.value ? '🔇 Muted' : '🔊 Unmuted')
      return
    }
  }

  function toggleFullscreen(element = null) {
    // Try to find the emulator container - prioritize the game container div
    const target = element || 
      document.getElementById('emulator-container') ||
      document.querySelector('.emulator-container') || 
      document.querySelector('.game-display') ||
      document.documentElement
    
    console.log('[Shortcuts] Toggling fullscreen on:', target)
    
    if (!document.fullscreenElement) {
      const promise = target.requestFullscreen?.() || target.webkitRequestFullscreen?.()
      if (promise && promise.then) {
        promise.then(() => {
          isFullscreen.value = true
          showActionFeedback('🖥️ Fullscreen')
          if (onFullscreen) onFullscreen(true)
        }).catch(err => {
          console.warn('[Shortcuts] Fullscreen request failed:', err)
          showActionFeedback('❌ Fullscreen blocked')
        })
      } else {
        isFullscreen.value = true
        showActionFeedback('🖥️ Fullscreen')
        if (onFullscreen) onFullscreen(true)
      }
    } else {
      const promise = document.exitFullscreen?.() || document.webkitExitFullscreen?.()
      if (promise && promise.then) {
        promise.then(() => {
          isFullscreen.value = false
          showActionFeedback('🖥️ Exit Fullscreen')
          if (onFullscreen) onFullscreen(false)
        }).catch(err => {
          console.warn('[Shortcuts] Exit fullscreen failed:', err)
        })
      } else {
        isFullscreen.value = false
        showActionFeedback('🖥️ Exit Fullscreen')
        if (onFullscreen) onFullscreen(false)
      }
    }
  }

  function handleFullscreenChange() {
    isFullscreen.value = !!document.fullscreenElement
  }

  onMounted(() => {
    // Use capture phase to intercept events before they reach iframes
    window.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    isActive.value = true
    console.log('[Shortcuts] Keyboard shortcuts activated')
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown, true)
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
    isActive.value = false
    console.log('[Shortcuts] Keyboard shortcuts deactivated')
  })

  return {
    shortcuts,
    isFullscreen,
    isPaused,
    isMuted,
    lastAction,
    isActive,
    toggleFullscreen
  }
}


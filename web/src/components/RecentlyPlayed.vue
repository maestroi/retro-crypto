<template>
  <div v-if="recentGames.length > 0" class="flex items-center gap-3 py-2">
    <!-- Label -->
    <span class="text-xs font-medium text-gray-500 whitespace-nowrap flex items-center gap-1.5">
      <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Recent:
    </span>
    
    <!-- Horizontal scrolling game chips -->
    <div class="flex items-center gap-2 overflow-x-auto scrollbar-hide">
      <button
        v-for="game in recentGames"
        :key="game.appId"
        @click="$emit('select', game)"
        class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-800/80 hover:bg-gray-700 border border-gray-700/50 hover:border-gray-600 transition-colors group whitespace-nowrap"
      >
        <!-- Platform Icon -->
        <span class="text-sm">{{ getPlatformIcon(game.platform) }}</span>
        
        <!-- Game Title -->
        <span class="text-sm text-gray-300 group-hover:text-white transition-colors max-w-[120px] truncate">
          {{ game.title }}
        </span>
        
        <!-- Time ago -->
        <span class="text-xs text-gray-500">{{ formatLastPlayed(game.lastPlayed) }}</span>
      </button>
    </div>
    
    <!-- Clear button -->
    <button 
      @click="$emit('clear')"
      class="text-xs text-gray-600 hover:text-gray-400 transition-colors whitespace-nowrap"
      title="Clear history"
    >
      ✕
    </button>
  </div>
</template>

<script setup>
import { useRecentlyPlayed } from '../composables/useRecentlyPlayed.js'

defineProps({
  recentGames: {
    type: Array,
    required: true
  }
})

defineEmits(['select', 'clear'])

const { formatLastPlayed } = useRecentlyPlayed()

function getPlatformIcon(platform) {
  const icons = {
    'DOS': '💾',
    'GB': '🎮',
    'GBC': '🎨',
    'NES': '🕹️'
  }
  return icons[platform] || '🎮'
}
</script>


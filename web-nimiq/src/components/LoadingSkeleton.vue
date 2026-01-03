<template>
  <div class="animate-pulse space-y-4">
    <!-- Platform Select Skeleton -->
    <div>
      <div class="h-3 w-16 bg-gray-700 rounded mb-2"></div>
      <div class="h-8 w-full bg-gray-700 rounded"></div>
    </div>
    
    <!-- Game Select Skeleton -->
    <div>
      <div class="h-3 w-12 bg-gray-700 rounded mb-2"></div>
      <div class="h-8 w-full bg-gray-700 rounded"></div>
    </div>
    
    <!-- Game Cards Skeleton -->
    <div v-if="showCards" class="pt-4 border-t border-gray-700/50">
      <div class="grid grid-cols-1 gap-3">
        <div v-for="i in cardCount" :key="i" class="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg">
          <div class="w-10 h-10 bg-gray-600 rounded"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 bg-gray-600 rounded w-3/4"></div>
            <div class="h-3 bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Info Section Skeleton -->
    <div v-if="showInfo" class="pt-4 border-t border-gray-700/50 space-y-3">
      <div class="h-4 w-24 bg-gray-600 rounded"></div>
      <div class="space-y-2">
        <div class="flex justify-between">
          <div class="h-3 w-16 bg-gray-700 rounded"></div>
          <div class="h-3 w-20 bg-gray-700 rounded"></div>
        </div>
        <div class="flex justify-between">
          <div class="h-3 w-20 bg-gray-700 rounded"></div>
          <div class="h-3 w-32 bg-gray-700 rounded"></div>
        </div>
      </div>
    </div>
    
    <!-- Button Skeleton -->
    <div class="pt-4">
      <div class="h-10 w-full bg-gray-700 rounded"></div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  showCards: {
    type: Boolean,
    default: true
  },
  cardCount: {
    type: Number,
    default: 3
  },
  showInfo: {
    type: Boolean,
    default: false
  }
})
</script>


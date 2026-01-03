<template>
  <div class="rounded-lg bg-gray-800/50 border border-gray-700/50 overflow-hidden">
    <!-- Header -->
    <div class="px-4 py-3 bg-gray-800 border-b border-gray-700/50 flex items-center justify-between">
      <h3 class="text-sm font-semibold text-white flex items-center gap-2">
        <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
        Save States
      </h3>
      
      <div class="flex items-center gap-2">
        <!-- Quick Save Button -->
        <button
          v-if="canSave"
          @click="$emit('quick-save')"
          :disabled="loading"
          class="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50"
          title="Quick Save (F5)"
        >
          Save
        </button>
        
        <!-- Quick Load Button -->
        <button
          v-if="saves.length > 0"
          @click="handleQuickLoad"
          :disabled="loading"
          class="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
          title="Quick Load (F9)"
        >
          Load
        </button>
        
        <!-- Import Button -->
        <label class="cursor-pointer">
          <input type="file" accept=".save" @change="handleImport" class="hidden" />
          <span class="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors inline-block">
            Import
          </span>
        </label>
      </div>
    </div>
    
    <!-- Saves List -->
    <div class="max-h-48 overflow-y-auto">
      <div v-if="saves.length === 0" class="p-4 text-center text-gray-500 text-sm">
        No save states yet
      </div>
      
      <div v-else class="divide-y divide-gray-700/50">
        <div 
          v-for="save in saves" 
          :key="save.id"
          class="p-3 hover:bg-gray-700/30 transition-colors group"
        >
          <div class="flex items-start gap-3">
            <!-- Screenshot Thumbnail -->
            <div class="w-16 h-12 bg-gray-700 rounded overflow-hidden flex-shrink-0">
              <img 
                v-if="save.screenshot" 
                :src="save.screenshot" 
                class="w-full h-full object-cover"
                alt="Save screenshot"
              />
              <div v-else class="w-full h-full flex items-center justify-center text-gray-500">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            
            <!-- Save Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span 
                  v-if="!editingId || editingId !== save.id"
                  class="text-sm text-white font-medium truncate"
                >
                  {{ save.name }}
                </span>
                <input
                  v-else
                  v-model="editName"
                  @blur="saveRename(save.id)"
                  @keyup.enter="saveRename(save.id)"
                  @keyup.escape="cancelRename"
                  ref="editInput"
                  class="text-sm bg-gray-700 text-white px-1 rounded border border-gray-600 w-full"
                />
              </div>
              <div class="text-xs text-gray-500 mt-0.5">
                {{ formatTimestamp(save.timestamp) }}
              </div>
            </div>
            
            <!-- Actions -->
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                @click="$emit('load', save.id)"
                class="p-1.5 text-blue-400 hover:bg-blue-400/20 rounded transition-colors"
                title="Load"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </button>
              <button
                @click="startRename(save)"
                class="p-1.5 text-gray-400 hover:bg-gray-400/20 rounded transition-colors"
                title="Rename"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                @click="handleExport(save.id)"
                class="p-1.5 text-gray-400 hover:bg-gray-400/20 rounded transition-colors"
                title="Export"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <button
                @click="handleDelete(save.id)"
                class="p-1.5 text-red-400 hover:bg-red-400/20 rounded transition-colors"
                title="Delete"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { useSaveStates } from '../composables/useSaveStates.js'

const props = defineProps({
  saves: {
    type: Array,
    default: () => []
  },
  canSave: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['load', 'quick-save', 'import'])

const { deleteSave, renameSave, exportSave, importSave, formatTimestamp } = useSaveStates()

const editingId = ref(null)
const editName = ref('')
const editInput = ref(null)

function handleQuickLoad() {
  if (props.saves.length > 0) {
    emit('load', props.saves[0].id)
  }
}

function startRename(save) {
  editingId.value = save.id
  editName.value = save.name
  nextTick(() => {
    editInput.value?.focus()
    editInput.value?.select()
  })
}

async function saveRename(saveId) {
  if (editName.value && editName.value.trim()) {
    await renameSave(saveId, editName.value.trim())
  }
  cancelRename()
}

function cancelRename() {
  editingId.value = null
  editName.value = ''
}

async function handleDelete(saveId) {
  if (confirm('Delete this save state?')) {
    await deleteSave(saveId)
  }
}

async function handleExport(saveId) {
  await exportSave(saveId)
}

async function handleImport(event) {
  const file = event.target.files?.[0]
  if (file) {
    try {
      await importSave(file)
      emit('import')
    } catch (err) {
      alert(`Failed to import save: ${err.message}`)
    }
  }
  event.target.value = ''
}
</script>


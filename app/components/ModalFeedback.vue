<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  messageId: string
}>()

const emit = defineEmits<{ 
  'update:modelValue': [value: boolean]
  'submit': [comment: string]
}>()

const comment = ref('')
const loading = ref(false)

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => {
    if (!value) {
      comment.value = '' // Reset comment when closing
    }
    emit('update:modelValue', value)
  }
})

async function handleSubmit() {
  if (!comment.value.trim()) return
  
  loading.value = true
  try {
    await $fetch(`/api/messages/${props.messageId}/feedback`, {
      method: 'POST',
      body: {
        rating: 'negative',
        comment: comment.value
      }
    })
    emit('submit', comment.value)
    comment.value = '' // Reset comment
    isOpen.value = false
  } catch (error) {
    console.error('Failed to submit feedback:', error)
  } finally {
    loading.value = false
  }
}

function handleCancel() {
  comment.value = '' // Reset comment
  isOpen.value = false
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="handleCancel" />
    
    <!-- Modal -->
    <div class="flex min-h-full items-center justify-center p-4">
      <div class="relative w-full max-w-md transform overflow-hidden rounded-lg shadow-xl transition-all" style="background-color: var(--ui-bg)">
        <!-- Header -->
        <div class="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-highlighted">
              What went wrong?
            </h3>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-heroicons-x-mark-20-solid"
              size="sm"
              @click="handleCancel"
            />
          </div>
        </div>
        
        <!-- Body -->
        <div class="px-6 py-4">
          <p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Your feedback helps us improve our responses
          </p>
          <UTextarea
            v-model="comment"
            placeholder="Tell us what could be improved..."
            :rows="4"
            autofocus
            class="w-full"
          />
        </div>
        
        <!-- Footer -->
        <div class="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <div class="flex justify-end gap-3">
            <UButton
              color="neutral"
              variant="ghost"
              label="Cancel"
              :disabled="loading"
              @click="handleCancel"
            />
            <UButton 
              label="Submit"
              color="primary"
              :loading="loading"
              :disabled="!comment.trim()"
              @click="handleSubmit" 
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
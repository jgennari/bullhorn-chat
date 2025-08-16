<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const { clear } = useUserSession()
const toast = useToast()

// Fetch full user data with corporation info
const { data: userWithCorp } = await useFetch('/api/auth/me', {
  immediate: false
})

// Fetch user data when modal opens
watch(isOpen, async (newValue) => {
  if (newValue && !userWithCorp.value) {
    await useFetch('/api/auth/me').then(({ data }) => {
      if (data.value) {
        userWithCorp.value = data.value
      }
    })
  }
})

const corporationPrompt = ref('')
const originalPrompt = ref('')
const userName = ref('')
const originalUserName = ref('')
const isSaving = ref(false)

// Initialize corporation prompt and user name when user data is loaded
watch(userWithCorp, (userData) => {
  if (userData) {
    if (userData.corporationPrompt !== undefined) {
      corporationPrompt.value = userData.corporationPrompt || ''
      originalPrompt.value = userData.corporationPrompt || ''
    }
    userName.value = userData.name || ''
    originalUserName.value = userData.name || ''
  }
}, { immediate: true })

// Check if there are unsaved changes
const hasChanges = computed(() => {
  return corporationPrompt.value !== originalPrompt.value || userName.value !== originalUserName.value
})

const handleSave = async () => {
  if (!hasChanges.value) {
    isOpen.value = false
    return
  }
  
  isSaving.value = true
  
  try {
    const promises = []
    
    // Save user name if changed
    if (userName.value !== originalUserName.value) {
      promises.push(
        $fetch('/api/auth/me', {
          method: 'PATCH',
          body: {
            name: userName.value
          }
        })
      )
    }
    
    // Save corporation prompt if changed and user is admin
    if (userWithCorp.value?.corpId && corporationPrompt.value !== originalPrompt.value) {
      promises.push(
        $fetch(`/api/corporations/${userWithCorp.value.corpId}/prompt`, {
          method: 'PATCH',
          body: {
            prompt: corporationPrompt.value
          }
        })
      )
    }
    
    await Promise.all(promises)
    
    // Update the original values to match saved values
    originalUserName.value = userName.value
    originalPrompt.value = corporationPrompt.value
    
    // Update the cached user data
    if (userWithCorp.value) {
      userWithCorp.value.name = userName.value
      userWithCorp.value.corporationPrompt = corporationPrompt.value
    }
    
    toast.add({
      title: 'Success',
      description: 'Settings updated successfully',
      icon: 'i-lucide-check-circle',
      color: 'success'
    })
    
    // Emit saved event to notify parent components
    emit('saved')
    
    isOpen.value = false
  } catch (error) {
    console.error('Failed to save settings:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to save settings',
      icon: 'i-lucide-alert-circle',
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}

const handleLogout = async () => {
  try {
    // Call the logout API to revoke the token
    await $fetch('/api/auth/logout', { method: 'POST' })
  } catch (error) {
    // Log error but continue with logout
    console.error('Failed to revoke token:', error)
  }

  // Clear the local session
  clear()
  isOpen.value = false
  await navigateTo('/')
}
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
              Settings
            </h3>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              size="sm"
              square
              @click="isOpen = false"
            />
          </div>
        </template>

          <!-- Account Section -->
          <div class="">
            <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3 border-b border-gray-300 dark:border-gray-700">
              User Settings
            </h4>
            <div class="space-y-3">
              <div>
                <label class="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Name
                </label>
                <UInput
                  v-model="userName"
                  placeholder="Enter your name"
                  size="sm"
                  class="w-full"
                />
              </div>
            </div>
          </div>

        <div class="space-y-6 min-h-[200px] mt-6">
          <!-- Corporation Settings - Only for admins -->
          <div v-if="userWithCorp?.userType === 'admin' && userWithCorp?.corporationName" class="space-y-3">
            <h4 class="text-sm font-medium text-gray-900 dark:text-white border-b border-gray-300 dark:border-gray-700">
              Corporation Settings
            </h4>
            <div class="space-y-2">
              <div class="mb-1">
                <label class="block text-sm text-gray-600 dark:text-gray-400 w-full">
                  Custom Instructions
                </label>
              </div>
              <UTextarea
                v-model="corporationPrompt"
                placeholder="Enter a custom prompt for your corporation..."
                :rows="4"
                class="w-full"
                :ui="{ base: 'text-sm w-full' }"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400">
                These instructions will be used to customize AI responses for your organization.
              </p>
            </div>
          </div>
          
        </div>

        <template #footer>
          <div class="flex justify-between items-center">
            <UButton
              color="error"
              variant="soft"
              icon="i-lucide-log-out"
              label="Log out"
              size="sm"
              @click="handleLogout"
            />
            <div class="flex gap-3">
              <UButton
                color="neutral"
                variant="ghost"
                label="Cancel"
                :disabled="isSaving"
                @click="isOpen = false"
              />
              <UButton
                color="primary"
                label="Save"
                :loading="isSaving"
                :disabled="!hasChanges || isSaving"
                @click="handleSave"
              />
            </div>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
<script setup lang="ts">
const { 
  isAuthenticated, 
  userEmail,
  isLoading,
  initiateAuth, 
  clearAuth,
  getTimeUntilExpiry,
  checkAuthStatus
} = useGoogleAuth()

const toast = useToast()

// Check for auth errors in query params
onMounted(() => {
  const route = useRoute()
  if (route.query.error === 'google_auth_failed') {
    toast.add({
      title: 'Authentication Failed',
      description: 'Failed to connect Google Workspace. Please try again.',
      icon: 'i-lucide-alert-circle',
      color: 'error'
    })
  } else if (route.query.google_connected === 'true') {
    toast.add({
      title: 'Success',
      description: 'Google Workspace connected successfully',
      icon: 'i-lucide-check-circle',
      color: 'success'
    })
    // Refresh auth status
    checkAuthStatus()
  }
})

const handleConnect = () => {
  // This will redirect to the OAuth flow
  initiateAuth()
}

const handleDisconnect = async () => {
  await clearAuth()
  toast.add({
    title: 'Disconnected',
    description: 'Google Workspace has been disconnected',
    icon: 'i-lucide-info',
    color: 'neutral'
  })
}

// Format time remaining
const timeRemaining = computed(() => {
  if (!isAuthenticated.value) return null
  
  const seconds = getTimeUntilExpiry()
  if (seconds <= 0) return 'Expired'
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
})
</script>

<template>
  <div class="space-y-3">
    <h4 class="text-sm font-medium text-gray-900 dark:text-white border-b border-gray-300 dark:border-gray-700 pb-2">
      Google Workspace
    </h4>
    
    <div v-if="isAuthenticated" class="space-y-3">
      <!-- Connected Account Info -->
      <div class="bg-success/10 border border-success/20 rounded-md p-3">
        <div class="flex items-start gap-3">
          <Icon name="i-lucide-check-circle" class="w-5 h-5 text-success mt-0.5" />
          <div class="flex-1 space-y-1">
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              Connected
            </p>
            <p v-if="userEmail" class="text-xs text-gray-600 dark:text-gray-400">
              {{ userEmail }}
            </p>
            <p v-if="timeRemaining" class="text-xs text-gray-500 dark:text-gray-500">
              Token expires in {{ timeRemaining }}
            </p>
          </div>
        </div>
      </div>

      <!-- Available Features -->
      <div class="space-y-1">
        <p class="text-xs font-medium text-gray-700 dark:text-gray-300">Available features:</p>
        <ul class="text-xs text-gray-600 dark:text-gray-400 space-y-0.5 ml-4">
          <li>• Send and manage emails</li>
          <li>• Create and update calendar events</li>
          <li>• Access Google Drive files</li>
          <li>• Manage tasks and documents</li>
        </ul>
      </div>

      <!-- Disconnect Button -->
      <UButton
        color="error"
        variant="soft"
        size="sm"
        icon="i-lucide-unlink"
        label="Disconnect Google Workspace"
        block
        @click="handleDisconnect"
      />
    </div>

    <div v-else class="space-y-3">
      <!-- Not Connected Info -->
      <div class="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-3">
        <div class="flex items-start gap-3">
          <Icon name="i-lucide-info" class="w-5 h-5 text-gray-500 mt-0.5" />
          <div class="flex-1 space-y-1">
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              Not Connected
            </p>
            <p class="text-xs text-gray-600 dark:text-gray-400">
              Connect your Google account to enable email, calendar, and document features.
            </p>
          </div>
        </div>
      </div>

      <!-- Connect Button -->
      <UButton
        color="primary"
        variant="solid"
        size="sm"
        icon="i-lucide-link"
        label="Connect Google Workspace"
        block
        :loading="isLoading"
        @click="handleConnect"
      />
    </div>

    <!-- Privacy Note -->
    <p class="text-xs text-gray-500 dark:text-gray-500 italic">
      Your Google credentials are stored securely and used only for accessing Google Workspace services.
    </p>
  </div>
</template>
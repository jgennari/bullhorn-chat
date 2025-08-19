<script setup lang="ts">
const { 
  isAuthenticated,
  userEmail,
  isLoading,
  initiateAuth,
  clearAuth,
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
</script>

<template>
  <div class="space-y-3">
    <h4 class="text-sm font-medium text-gray-900 dark:text-white border-b border-gray-300 dark:border-gray-700 pb-2">
      Google Workspace
    </h4>
    
    <div class="flex items-center gap-3">
      <UButton
        v-if="!isAuthenticated"
        color="primary"
        variant="solid"
        size="sm"
        icon="i-lucide-link"
        label="Enable Google Workspace"
        :loading="isLoading"
        @click="handleConnect"
      />
      
      <template v-else>
        <UButton
          color="error"
          variant="soft"
          size="sm"
          icon="i-lucide-unlink"
          label="Disable Google Workspace"
          @click="handleDisconnect"
        />
        <span v-if="userEmail" class="text-xs text-gray-600 dark:text-gray-400">
          Connected: {{ userEmail }}
        </span>
      </template>
    </div>
  </div>
</template>
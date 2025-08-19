interface GoogleAuthStatus {
  authenticated: boolean
  connected: boolean
  email?: string
  expiresAt?: string
  needsRefresh?: boolean
}

export const useGoogleAuth = () => {
  // Reactive state for auth status - fetched from server
  const authStatus = useState<GoogleAuthStatus | null>('google-auth-status', () => null)
  const isLoading = ref(false)
  
  const isAuthenticated = computed(() => authStatus.value?.connected || false)
  const userEmail = computed(() => authStatus.value?.email || null)
  const needsRefresh = computed(() => authStatus.value?.needsRefresh || false)

  /**
   * Check authentication status from server
   */
  const checkAuthStatus = async () => {
    if (!import.meta.client) return
    
    isLoading.value = true
    try {
      const status = await $fetch('/api/auth/google/status')
      authStatus.value = status
      
      // If token needs refresh, trigger it
      if (status.needsRefresh && status.connected) {
        await refreshToken()
      }
    } catch (error) {
      console.error('Failed to check Google auth status:', error)
      authStatus.value = { authenticated: false, connected: false }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Initiate OAuth flow via server redirect
   */
  const initiateAuth = async (): Promise<void> => {
    if (!import.meta.client) return
    
    // Redirect to server OAuth endpoint
    window.location.href = '/auth/google'
  }

  /**
   * Refresh token via server
   */
  const refreshToken = async (): Promise<boolean> => {
    if (!import.meta.client) return false
    
    try {
      const result = await $fetch('/api/auth/google/refresh', {
        method: 'POST'
      })
      
      if (result.success) {
        // Update auth status
        await checkAuthStatus()
        return true
      }
    } catch (error: any) {
      console.error('Failed to refresh Google token:', error)
      
      // If refresh failed due to expired token, clear auth status
      if (error.statusCode === 401) {
        authStatus.value = { authenticated: true, connected: false }
      }
    }
    
    return false
  }

  /**
   * Get current access token from server
   */
  const getAccessToken = async (): Promise<string | null> => {
    if (!isAuthenticated.value) return null
    
    // Check if we need to refresh first
    if (needsRefresh.value) {
      const refreshed = await refreshToken()
      if (!refreshed) return null
    }
    
    // Server will handle providing the token when needed
    // For now, we just indicate auth is available
    return 'server-managed'
  }

  /**
   * Disconnect Google account
   */
  const clearAuth = async () => {
    if (!import.meta.client) return
    
    try {
      await $fetch('/api/auth/google/disconnect', {
        method: 'POST'
      })
      
      authStatus.value = { authenticated: true, connected: false }
    } catch (error) {
      console.error('Failed to disconnect Google account:', error)
    }
  }

  /**
   * Get remaining time until token expires (in seconds)
   */
  const getTimeUntilExpiry = (): number => {
    if (!authStatus.value?.expiresAt) return 0
    const expiresAt = new Date(authStatus.value.expiresAt).getTime()
    const remaining = Math.floor((expiresAt - Date.now()) / 1000)
    return Math.max(0, remaining)
  }

  // Check auth status on mount
  if (import.meta.client) {
    onMounted(() => {
      checkAuthStatus()
    })
    
    // Check for successful connection from redirect
    const route = useRoute()
    if (route.query.google_connected === 'true') {
      checkAuthStatus()
      // Clear the query parameter
      navigateTo(route.path, { replace: true })
    }
  }

  return {
    isAuthenticated: readonly(isAuthenticated),
    userEmail: readonly(userEmail),
    isLoading: readonly(isLoading),
    initiateAuth,
    getAccessToken,
    refreshToken,
    clearAuth,
    getTimeUntilExpiry,
    checkAuthStatus
  }
}
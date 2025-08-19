<script setup lang="ts">
const route = useRoute()
const { handleCallback } = useGoogleAuth()

// Process OAuth callback on mount
onMounted(() => {
  // Check if we have tokens in the URL hash (for implicit flow)
  const hashParams = new URLSearchParams(window.location.hash.substring(1))
  const accessToken = hashParams.get('access_token')
  
  // Check if we have tokens in query params (for code flow response)
  const queryAccessToken = route.query.access_token as string
  
  if (accessToken || queryAccessToken) {
    const tokens = {
      access_token: (accessToken || queryAccessToken) as string,
      id_token: (hashParams.get('id_token') || route.query.id_token) as string | undefined,
      token_type: (hashParams.get('token_type') || route.query.token_type || 'Bearer') as string,
      expires_in: parseInt(hashParams.get('expires_in') || route.query.expires_in as string || '3600'),
      scope: (hashParams.get('scope') || route.query.scope || '') as string
    }
    
    // Handle the callback
    handleCallback(tokens)
    
    // If we're in a popup, the handleCallback will close it
    // If not, redirect to home
    if (!window.opener) {
      setTimeout(() => {
        navigateTo('/')
      }, 1000)
    }
  } else if (route.query.error) {
    // Handle error
    console.error('OAuth error:', route.query.error, route.query.error_description)
    
    // Post error message to opener if in popup
    if (window.opener) {
      window.opener.postMessage({
        type: 'google-auth-error',
        error: route.query.error,
        description: route.query.error_description
      }, window.location.origin)
      window.close()
    } else {
      // Redirect to home with error
      setTimeout(() => {
        navigateTo('/')
      }, 2000)
    }
  } else {
    // No tokens or error, something went wrong
    console.error('No tokens or error in callback')
    if (window.opener) {
      window.opener.postMessage({
        type: 'google-auth-error',
        error: 'no_tokens',
        description: 'No tokens received in callback'
      }, window.location.origin)
      window.close()
    } else {
      navigateTo('/')
    }
  }
})
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-background">
    <div class="text-center">
      <div class="mb-4">
        <Icon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-primary" />
      </div>
      <h2 class="text-lg font-semibold mb-2">Completing Google Authentication...</h2>
      <p class="text-sm text-muted">Please wait while we process your authentication.</p>
    </div>
  </div>
</template>
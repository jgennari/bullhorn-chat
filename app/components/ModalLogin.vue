<script setup lang="ts">
function handleLogin() {
  // Redirect in the same window instead of popup
  window.location.href = '/auth/bullhorn'
}
</script>

<template>
  <div class="rounded-lg shadow-xl w-full max-w-sm mx-4" style="background-color: var(--ui-bg)">
    <div class="text-center p-8">
      <!-- Logo and Chat title -->
      <div class="flex items-end justify-center gap-0.5 mb-6">
        <Logo class="h-8 w-auto shrink-0" />
        <span class="text-xl font-bold text-highlighted">Chat</span>
      </div>

      <!-- Warning message -->
      <div class="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
        <p class="text-sm text-yellow-800 dark:text-yellow-200 font-semibold">
          Experimental Feature
        </p>
        <p class="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
          This AI assistant has access to live Bullhorn data. Please use caution when working with sensitive information and verify all AI-generated responses.
        </p>
      </div>

      <!-- Login button -->
      <UButton
        label="Login with Bullhorn"
        icon="i-lucide-log-in"
        size="lg"
        class="w-full"
        @click="handleLogin"
      />
    </div>
  </div>
</template>
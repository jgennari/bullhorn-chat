<script setup lang="ts">
function handleLogin() {
  // Redirect in the same window instead of popup
  window.location.href = '/auth/bullhorn'
}
</script>

<template>
  <div class="rounded-lg shadow-xl w-full max-w-xl mx-4" style="background-color: var(--ui-bg)">
    <div class="text-center p-8">
      <!-- Logo and Chat title -->
      <div class="flex items-end justify-center gap-0.5 mb-6">
        <Logo class="h-8 w-auto shrink-0" />
        <span class="text-xl font-bold text-highlighted">Chat</span>
      </div>

      <!-- Warning message -->
      <div
        class="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
        <p class="text-md text-black dark:text-white font-semibold">
          Experimental Feature
        </p>
        <p class="text-sm text-black dark:text-white mt-2 text-left">
          This AI assistant can access and modify your live Bullhorn data. Before proceeding, please be aware:
        </p>
        <ul class="list-disc list-inside mt-2 text-sm text-black dark:text-white text-left space-y-3">
          <li>Data Access: The assistant can view, search, and analyze your Bullhorn records including candidates, job
            orders, and client information</li>
          <li>Modification Capabilities: The assistant can create, update, and delete records in your system</li>
          <li>Verification Required: Always review AI-generated responses and verify any data changes before finalizing
          </li>
          <li>Sensitive Information: Exercise extra caution when discussing confidential candidate or client details
          </li>
        </ul>
        <p class="text-sm text-black dark:text-white mt-2 text-left">
          By continuing, you acknowledge this is experimental technology and agree to use appropriate oversight.
        </p>
      </div>

      <!-- Login button -->
      <UButton label="Login with Bullhorn" icon="i-lucide-log-in" size="lg" class="w-full" @click="handleLogin" />
    </div>
  </div>
</template>
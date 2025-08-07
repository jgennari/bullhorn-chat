<script setup lang="ts">
const input = ref('')
const loading = ref(false)

const { loggedIn } = useUserSession()

async function createChat(prompt: string) {
  if (!loggedIn.value) return
  
  input.value = prompt
  loading.value = true
  const chat = await $fetch('/api/chats', {
    method: 'POST',
    body: { input: prompt }
  })

  console.log('[Frontend] Created chat:', chat.id)
  
  // Small delay to ensure database commit
  await new Promise(resolve => setTimeout(resolve, 100))
  
  refreshNuxtData('chats')
  navigateTo(`/chat/${chat.id}`)
}

function onSubmit() {
  if (!loggedIn.value) return
  createChat(input.value)
}

const quickChats = [
  {
    label: 'What can you do for me?',
    icon: 'i-lucide-help-circle'
  },
  {
    label: 'List my open tasks.',
    icon: 'i-lucide-clipboard-list'
  },
  {
    label: 'Find jobs that don’t have any submissions yet.',
    icon: 'i-lucide-inbox'
  },
  {
    label: 'Show me the oldest open jobs.',
    icon: 'i-lucide-clock'
  },
  {
    label: 'Improve a job description.',
    icon: 'i-lucide-file-text'
  }
]
</script>

<template>
  <UDashboardPanel id="home" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <DashboardNavbar />
    </template>

    <template #body>
      <UContainer class="flex-1 flex flex-col justify-center gap-4 sm:gap-6 py-8">
        <h1 class="text-3xl sm:text-4xl text-highlighted font-bold">
          How can I help you today?
        </h1>

        <UChatPrompt
          v-model="input"
          :status="loading ? 'streaming' : 'ready'"
          :disabled="!loggedIn"
          class="[view-transition-name:chat-prompt]"
          variant="subtle"
          @submit="onSubmit"
        >
          <UChatPromptSubmit color="neutral" />

          <template #footer>
            <div class="flex items-center gap-2">
              <ToolsMenu />
            </div>
          </template>
        </UChatPrompt>

        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="quickChat in quickChats"
            :key="quickChat.label"
            :icon="quickChat.icon"
            :label="quickChat.label"
            size="sm"
            color="neutral"
            variant="outline"
            class="rounded-full"
            @click="createChat(quickChat.label)"
          />
        </div>
      </UContainer>
    </template>
  </UDashboardPanel>

  <!-- Full screen overlay when not logged in -->
  <div v-if="!loggedIn" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
    <ModalLogin />
  </div>
</template>

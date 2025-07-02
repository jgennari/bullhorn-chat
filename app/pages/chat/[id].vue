<script setup lang="ts">
import type { DefineComponent } from 'vue'
import { useChat, type Message } from '@ai-sdk/vue'
import { useClipboard } from '@vueuse/core'
import ProseStreamPre from '../../components/prose/PreStream.vue'
import ProseA from '../../components/prose/ProseA.vue'

const components = {
  pre: ProseStreamPre as unknown as DefineComponent,
  p: 'p', // Use regular p tag instead of prose-p
  a: ProseA as unknown as DefineComponent
}

const route = useRoute()
const toast = useToast()
const clipboard = useClipboard()
const { model } = useLLM()
const refreshChats = inject<() => Promise<void>>('refreshChats')

// Only use Datadog on client side
const { trackMessageSent } = import.meta.client
  ? useDatadog()
  : { trackMessageSent: () => {} }

const { data: chat } = await useFetch(`/api/chats/${route.params.id}`, {
  // Don't use cache for new chats
  cache: 'no-cache'
})
if (!chat.value) {
  throw createError({ statusCode: 404, statusMessage: 'Chat not found', fatal: true })
}

// Title polling state
const titlePollingInterval = ref<NodeJS.Timeout | null>(null)

// Function to poll for title updates
async function pollForTitle() {
  // Only poll if there's no title yet
  if (!chat.value || chat.value.title) {
    return
  }

  let pollCount = 0
  const maxPolls = 30 // 30 * 2 seconds = 1 minute max

  titlePollingInterval.value = setInterval(async () => {
    pollCount++

    try {
      const updatedChat = await $fetch(`/api/chats/${route.params.id}`)

      if (updatedChat?.title) {
        // Title found! Update local state and stop polling
        if (chat.value) {
          chat.value.title = updatedChat.title
        }

        // Refresh the sidebar
        if (refreshChats) {
          await refreshChats()
        }

        // Stop polling
        if (titlePollingInterval.value) {
          clearInterval(titlePollingInterval.value)
          titlePollingInterval.value = null
        }
      }
    } catch (e) {
      console.error('Error polling for title:', e)
    }

    // Stop polling after max attempts
    if (pollCount >= maxPolls && titlePollingInterval.value) {
      clearInterval(titlePollingInterval.value)
      titlePollingInterval.value = null
    }
  }, 2000) // Poll every 2 seconds
}

// Cleanup on unmount
onUnmounted(() => {
  if (titlePollingInterval.value) {
    clearInterval(titlePollingInterval.value)
  }
})

const { messages, input, handleSubmit, reload, stop, status, error } = useChat({
  id: chat.value.id,
  api: `/api/chats/${chat.value.id}`,
  initialMessages: chat.value.messages.map(message => ({
    id: message.id,
    content: message.content,
    role: message.role
  })),
  body: {
    model: model.value
  },
  onResponse(_response) {
    // Start polling for title if this is the first message
    if (!chat.value?.title && messages.value.length <= 2) {
      pollForTitle()
    }
  },
  onError(error) {
    const { message } = typeof error.message === 'string' && error.message[0] === '{' ? JSON.parse(error.message) : error
    toast.add({
      description: message,
      icon: 'i-lucide-alert-circle',
      color: 'error',
      duration: 0
    })
  }
})

// Wrap handleSubmit to track message sends
const handleSubmitWithTracking = (e?: Event) => {
  // Track message before sending
  if (input.value && chat.value) {
    trackMessageSent(chat.value.id, input.value.length, 'user')
  }
  // Call the original handleSubmit
  return handleSubmit(e)
}

const copied = ref(false)

function copy(e: MouseEvent, message: Message) {
  clipboard.copy(message.content)

  copied.value = true

  setTimeout(() => {
    copied.value = false
  }, 2000)
}

onMounted(() => {
  if (chat.value?.messages.length === 1) {
    reload()
    // Also start polling for title if there isn't one
    if (!chat.value.title) {
      pollForTitle()
    }
  }
})
</script>

<template>
  <UDashboardPanel id="chat" class="relative" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <DashboardNavbar />
    </template>

    <template #body>
      <UContainer class="flex-1 flex flex-col gap-4 sm:gap-6">
        <UChatMessages
          :messages="messages"
          :status="status"
          :assistant="{ actions: [{ label: 'Copy', icon: copied ? 'i-lucide-copy-check' : 'i-lucide-copy', onClick: copy }] }"
          class="lg:pt-(--ui-header-height) pb-4 sm:pb-6"
          :spacing-offset="160"
        >
          <template #content="{ message }">
            <MDCCached
              :value="message.content"
              :cache-key="message.id"
              :components="components"
              :parser-options="{ highlight: false }"
            />
          </template>
        </UChatMessages>

        <UChatPrompt
          v-model="input"
          :error="error"
          variant="subtle"
          class="sticky bottom-0 [view-transition-name:chat-prompt] rounded-b-none z-10"
          @submit="handleSubmitWithTracking"
        >
          <UChatPromptSubmit
            :status="status"
            color="neutral"
            @stop="stop"
            @reload="reload"
          />

          <template #footer>
            <ModelSelect v-model="model" />
          </template>
        </UChatPrompt>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>

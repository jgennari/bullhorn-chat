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
const refreshChats = inject<() => Promise<void>>('refreshChats')
const { getEnabledTools } = useMCPTools()

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

  // Clear any existing interval
  if (titlePollingInterval.value) {
    clearInterval(titlePollingInterval.value)
    titlePollingInterval.value = null
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

        // Stop polling FIRST before refreshing
        if (titlePollingInterval.value) {
          clearInterval(titlePollingInterval.value)
          titlePollingInterval.value = null
        }

        // Then refresh the sidebar
        if (refreshChats) {
          await refreshChats()
        }
        
        return // Exit early
      }
    } catch (e) {
      console.error('Error polling for title:', e)
    }

    // Stop polling after max attempts
    if (pollCount >= maxPolls) {
      if (titlePollingInterval.value) {
        clearInterval(titlePollingInterval.value)
        titlePollingInterval.value = null
      }
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
  body: {
    get enabledTools() {
      return getEnabledTools().map(t => t.id)
    }
  },
  initialMessages: chat.value.messages.map(message => ({
    id: message.id,
    content: message.content,
    role: message.role
  })),
  onResponse(response) {
    console.log('[Chat] Stream started, response headers:', response.headers)
    // Start polling for title if this is the first message
    if (!chat.value?.title && messages.value.length <= 2) {
      pollForTitle()
    }
  },
  onFinish(message, options) {
    // Log completion of streaming
    console.log('[Chat] Stream finished:', {
      messageId: message.id,
      messageLength: message.content?.length || 0,
      role: message.role,
      finishReason: options?.finishReason,
      usage: options?.usage,
      fullOptions: options
    })
    
    // Log all options to see what's available
    console.log('[Chat] Full options object:', options)
    
    // Check if we have response metadata in any field
    if (options) {
      // Check various possible locations for responseId
      const possibleResponseId = options.responseId || options.response_id || options.id
      if (possibleResponseId) {
        console.log('[Chat] Response ID found:', possibleResponseId)
      }
      
      // Check for message length in options
      if (options.messageLength !== undefined) {
        console.log('[Chat] Server reported message length:', options.messageLength)
        if (message.content?.length !== options.messageLength) {
          console.warn('[Chat] Length mismatch! Client:', message.content?.length, 'Server:', options.messageLength)
        }
      }
    }
  },
  onError(error) {
    const { message } = typeof error.message === 'string' && error.message[0] === '{' ? JSON.parse(error.message) : error
    console.error('[Chat] Error:', message)
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
const feedbackModalOpen = ref(false)
const feedbackMessageId = ref<string>('')
const messageFeedback = ref<Record<string, 'positive' | 'negative' | null>>({})
const feedbackLoaded = ref<Set<string>>(new Set()) // Track which messages have been checked

function copy(e: MouseEvent, message: Message) {
  clipboard.copy(message.content)

  copied.value = true

  setTimeout(() => {
    copied.value = false
  }, 2000)
}

async function handleThumbsUp(e: MouseEvent, message: Message) {
  await submitFeedback(message.id, 'positive')
}

async function handleThumbsDown(e: MouseEvent, message: Message) {
  // Show modal for comment
  feedbackMessageId.value = message.id
  // Use nextTick to ensure proper modal rendering
  await nextTick()
  feedbackModalOpen.value = true
}

async function submitFeedback(messageId: string, rating: 'positive' | 'negative', comment?: string) {
  try {
    await $fetch(`/api/messages/${messageId}/feedback`, {
      method: 'POST',
      body: { rating, comment }
    })
    messageFeedback.value[messageId] = rating
    toast.add({
      title: 'Feedback submitted',
      description: 'Thank you for your feedback!',
      icon: 'i-lucide-check-circle',
      color: 'success'
    })
  } catch (error) {
    console.error('Failed to submit feedback:', error)
    toast.add({
      title: 'Failed to submit feedback',
      icon: 'i-lucide-alert-circle',
      color: 'error'
    })
  }
}

function onFeedbackModalSubmit(comment: string) {
  // The modal handles submission itself, just update our local state
  messageFeedback.value[feedbackMessageId.value] = 'negative'
  toast.add({
    title: 'Feedback submitted',
    description: 'Thank you for your feedback!',
    icon: 'i-lucide-check-circle',
    color: 'success'
  })
}

// Load existing feedback for messages
async function loadFeedback() {
  for (const message of messages.value) {
    // Only load feedback for assistant messages we haven't checked yet
    if (message.role === 'assistant' && !feedbackLoaded.value.has(message.id)) {
      feedbackLoaded.value.add(message.id) // Mark as checked
      
      try {
        const feedback = await $fetch(`/api/messages/${message.id}/feedback`)
        if (feedback) {
          messageFeedback.value[message.id] = feedback.rating
        }
      } catch (error) {
        // Ignore errors for missing feedback
        // Message has been checked, so we won't retry
      }
    }
  }
}

// Get assistant actions
const assistantActions = computed(() => {
  return [
    { 
      label: 'Copy', 
      icon: copied.value ? 'i-lucide-copy-check' : 'i-lucide-copy', 
      onClick: copy 
    },
    {
      label: 'Good response',
      icon: 'i-lucide-thumbs-up',
      onClick: handleThumbsUp
    },
    {
      label: 'Bad response', 
      icon: 'i-lucide-thumbs-down',
      onClick: handleThumbsDown
    }
  ]
})

onMounted(() => {
  if (chat.value?.messages.length === 1) {
    reload()
    // Also start polling for title if there isn't one
    if (!chat.value.title) {
      pollForTitle()
    }
  }
  // Load existing feedback once on mount
  loadFeedback()
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
          :assistant="{ 
            actions: assistantActions
          }"
          class="lg:pt-(--ui-header-height) pb-4 sm:pb-6"
          :spacing-offset="160"
          name="message_list"
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
            <div class="flex items-center gap-2">
              <ToolsMenu />
            </div>
          </template>
        </UChatPrompt>
      </UContainer>
    </template>
  </UDashboardPanel>
  
  <!-- Feedback Modal -->
  <ClientOnly>
    <Teleport to="body">
      <ModalFeedback
        v-if="feedbackModalOpen"
        v-model="feedbackModalOpen"
        :message-id="feedbackMessageId"
        @submit="onFeedbackModalSubmit"
      />
    </Teleport>
  </ClientOnly>
</template>

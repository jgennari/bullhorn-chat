<script setup lang="ts">
const { mcpTools, toggleTool, isGoogleAuthenticated } = useMCPTools()
const { initiateAuth: initiateGoogleAuth } = useGoogleAuth()
const isOpen = ref(false)
const toast = useToast()

const handleToolToggle = async (toolId: string) => {
  const tool = mcpTools.value.find(t => t.id === toolId)
  
  // Check if tool requires Google auth and user is not authenticated
  if (tool?.requiresAuth && tool.authProvider === 'google' && !isGoogleAuthenticated.value) {
    // Prompt for authentication
    const success = await initiateGoogleAuth()
    if (success) {
      // Now toggle the tool
      toggleTool(toolId)
      toast.add({
        title: 'Success',
        description: 'Google Workspace connected and enabled',
        icon: 'i-lucide-check-circle',
        color: 'success'
      })
    } else {
      toast.add({
        title: 'Authentication Required',
        description: 'Please connect Google Workspace to use this tool',
        icon: 'i-lucide-info',
        color: 'neutral'
      })
    }
  } else {
    // Normal toggle
    toggleTool(toolId)
  }
}
</script>

<template>
  <UPopover v-model:open="isOpen">
    <UButton
      icon="i-fluent-toggle-multiple-16-regular"
      label="Tools"
      trailing-icon="i-lucide-chevron-down"
      variant="ghost"
      class="hover:bg-gray-100 dark:hover:bg-white/10 focus:bg-gray-100 dark:focus:bg-white/10 data-[state=open]:bg-gray-100 dark:data-[state=open]:bg-white/10 text-gray-700 dark:text-white"
      :ui="{
        trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200'
      }"
    />
    
    <template #content>
      <div class="p-2 min-w-[320px]">
        <div class="px-2 py-1.5 text-sm font-semibold text-default-500">
          Tools
        </div>
        
        <div class="space-y-0.5 mt-1">
          <div
            v-for="tool in mcpTools"
            :key="tool.id"
            class="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-default/50 transition-colors"
          >
            <USwitch
              :model-value="tool.enabled"
              :disabled="tool.locked"
              size="sm"
              @update:model-value="() => handleToolToggle(tool.id)"
            />
            
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-default-900">
                  {{ tool.name }}
                </span>
                <!-- Show auth indicator for Google Workspace -->
                <Icon 
                  v-if="tool.requiresAuth && tool.authProvider === 'google' && isGoogleAuthenticated"
                  name="i-lucide-check-circle"
                  class="w-3 h-3 text-success"
                />
                <span 
                  v-else-if="tool.requiresAuth && tool.authProvider === 'google' && !isGoogleAuthenticated"
                  class="text-xs text-gray-500"
                >
                  Auth required
                </span>
              </div>
              <div class="text-xs text-default-500 mt-0.5">
                {{ tool.description }}
              </div>
            </div>
            
            <span
              v-if="tool.comingSoon"
              class="text-xs text-gray-500 dark:text-gray-400"
            >
              Coming Soon
            </span>
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>
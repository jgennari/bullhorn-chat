<script setup lang="ts">
const { mcpTools, toggleTool } = useMCPTools()
const isOpen = ref(false)
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
              @update:model-value="() => toggleTool(tool.id)"
            />
            
            <div class="flex-1">
              <div class="text-sm font-medium text-default-900">
                {{ tool.name }}
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
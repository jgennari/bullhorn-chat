<script setup lang="ts">
const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const handleSave = () => {
  // TODO: Implement save functionality
  isOpen.value = false
}

const handleCancel = () => {
  isOpen.value = false
}
</script>

<template>
  <UModal v-model:open="isOpen">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
            Settings
          </h3>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-x-mark-20-solid"
            size="sm"
            @click="handleCancel"
          />
        </div>
      </template>

      <div class="space-y-4">
        <!-- Settings content will go here -->
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Settings options will be added here.
        </p>
      </div>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton
            color="neutral"
            variant="ghost"
            label="Cancel"
            @click="handleCancel"
          />
          <UButton
            color="primary"
            label="Save"
            @click="handleSave"
          />
        </div>
      </template>
    </UCard>
  </UModal>
</template>
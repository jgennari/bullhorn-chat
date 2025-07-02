<template>
  <a :href="href" target="_blank" rel="noopener noreferrer" class="text-primary underline" v-bind="$attrs">
    <slot />
  </a>
</template>

<script setup lang="ts">
defineProps<{
  href?: string
}>()
</script>
<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{
  collapsed?: boolean
}>()

const colorMode = useColorMode()
const { user, clear } = useUserSession()

// Fetch full user data with corporation info
const { data: userWithCorp } = await useFetch('/api/auth/me', {
  immediate: false
})

// Try to fetch user data when user is available
watch(user, async (newUser) => {
  if (newUser?.id) {
    await useFetch('/api/auth/me').then(({ data }) => {
      if (data.value) {
        userWithCorp.value = data.value
      }
    })
  }
}, { immediate: true })

const items = computed<DropdownMenuItem[][]>(() => {
  const userData = userWithCorp.value || user.value
  const labelItems: DropdownMenuItem[] = [{
    type: 'label',
    label: userData?.name || userData?.username,
    avatar: {
      src: userData?.avatar,
      alt: userData?.name || userData?.username
    }
  }]
  
  // Add corporation name if available
  if (userWithCorp.value?.corporationName) {
    labelItems.push({
      type: 'label',
      label: userWithCorp.value.corporationName,
      class: 'text-xs text-muted -mt-1'
    })
  }
  
  return [labelItems, [{
    label: 'Appearance',
    icon: 'i-lucide-sun-moon',
    children: [{
      label: 'Light',
      icon: 'i-lucide-sun',
      type: 'checkbox',
      checked: colorMode.value === 'light',
      onSelect(e: Event) {
        e.preventDefault()

        colorMode.preference = 'light'
      }
    }, {
      label: 'Dark',
      icon: 'i-lucide-moon',
      type: 'checkbox',
      checked: colorMode.value === 'dark',
      onUpdateChecked(checked: boolean) {
        if (checked) {
          colorMode.preference = 'dark'
        }
      },
      onSelect(e: Event) {
        e.preventDefault()
      }
    }]
  }, {
    label: 'Log out',
    icon: 'i-lucide-log-out',
    async onSelect() {
      try {
        // Call the logout API to revoke the token
        await $fetch('/api/auth/logout', { method: 'POST' })
      } catch (error) {
        // Log error but continue with logout
        console.error('Failed to revoke token:', error)
      }

      // Clear the local session
      clear()
      navigateTo('/')
    }
  }]]
})
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }"
  >
    <UButton
      v-bind="{
        label: collapsed ? undefined : (user?.name || user?.username),
        trailingIcon: collapsed ? undefined : 'i-lucide-chevrons-up-down'
      }"
      :avatar="{
        src: user?.avatar || undefined,
        alt: user?.name || user?.username
      }"
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated"
      :ui="{
        trailingIcon: 'text-dimmed'
      }"
    />
  </UDropdownMenu>
</template>

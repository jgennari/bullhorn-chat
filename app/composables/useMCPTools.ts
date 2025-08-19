export const useMCPTools = () => {
  const { isAuthenticated: isGoogleAuthenticated } = useGoogleAuth()
  
  const mcpTools = useState('mcp-tools', () => [
    {
      id: 'bullhorn-ats',
      name: 'Bullhorn ATS',
      description: 'Access Bullhorn ATS data and functionality',
      enabled: true,
      locked: false,
      comingSoon: false,
      requiresAuth: false
    },
    {
      id: 'bullhorn-analytics',
      name: 'Bullhorn Analytics',
      description: 'Access Bullhorn Analytics reports and insights',
      enabled: false,
      locked: false,
      comingSoon: false,
      requiresAuth: false
    },
    {
      id: 'sourcebreaker',
      name: 'SourceBreaker',
      description: 'Automate candidate search and business development with AI',
      enabled: false,
      locked: false,
      comingSoon: false,
      requiresAuth: false
    },
    {
      id: 'web-search',
      name: 'Web Search',
      description: 'Search the web for current information',
      enabled: true,
      locked: false,
      comingSoon: false,
      requiresAuth: false
    },
    {
      id: 'google-workspace',
      name: 'Google Workspace',
      description: 'Send emails, manage calendar, and access Google services',
      enabled: false,
      locked: false,
      comingSoon: false,
      requiresAuth: true,
      authProvider: 'google'
    }
  ])

  const toggleTool = (toolId: string) => {
    const tools = mcpTools.value
    const tool = tools.find(t => t.id === toolId)
    if (tool && !tool.locked) {
      // Check if tool requires auth and user is not authenticated
      if (tool.requiresAuth && tool.authProvider === 'google' && !isGoogleAuthenticated.value) {
        // Don't toggle, let UI handle auth prompt
        return false
      }
      tool.enabled = !tool.enabled
      return true
    }
    return false
  }

  const getEnabledTools = () => {
    return mcpTools.value.filter(t => {
      // Only return enabled tools that either don't require auth or user is authenticated
      if (!t.enabled) return false
      if (t.requiresAuth && t.authProvider === 'google') {
        return isGoogleAuthenticated.value
      }
      return true
    })
  }

  const isToolAvailable = (toolId: string) => {
    const tool = mcpTools.value.find(t => t.id === toolId)
    if (!tool) return false
    if (tool.requiresAuth && tool.authProvider === 'google') {
      return isGoogleAuthenticated.value
    }
    return true
  }

  return {
    mcpTools: readonly(mcpTools),
    toggleTool,
    getEnabledTools,
    isToolAvailable,
    isGoogleAuthenticated: readonly(isGoogleAuthenticated)
  }
}
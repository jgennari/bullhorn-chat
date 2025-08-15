export const useMCPTools = () => {
  const mcpTools = useState('mcp-tools', () => [
    {
      id: 'bullhorn-ats',
      name: 'Bullhorn ATS',
      description: 'Access Bullhorn ATS data and functionality',
      enabled: true,
      locked: false,
      comingSoon: false
    },
    {
      id: 'bullhorn-analytics',
      name: 'Bullhorn Analytics',
      description: 'Access Bullhorn Analytics reports and insights',
      enabled: false,
      locked: false,
      comingSoon: false
    },
    {
      id: 'sourcebreaker',
      name: 'SourceBreaker',
      description: 'Automate candidate search and business development with AI',
      enabled: false,
      locked: false,
      comingSoon: false
    },
    {
      id: 'web-search',
      name: 'Web Search',
      description: 'Search the web for current information',
      enabled: true,
      locked: false,
      comingSoon: false
    }
  ])

  const toggleTool = (toolId: string) => {
    const tools = mcpTools.value
    const tool = tools.find(t => t.id === toolId)
    if (tool && !tool.locked) {
      tool.enabled = !tool.enabled
    }
  }

  const getEnabledTools = () => {
    return mcpTools.value.filter(t => t.enabled)
  }

  return {
    mcpTools: readonly(mcpTools),
    toggleTool,
    getEnabledTools
  }
}
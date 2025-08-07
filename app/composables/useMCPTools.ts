export const useMCPTools = () => {
  const mcpTools = useState('mcp-tools', () => [
    {
      id: 'bullhorn-ats',
      name: 'Bullhorn ATS',
      description: 'Access Bullhorn ATS data and functionality',
      enabled: true,
      locked: true,
      comingSoon: false
    },
    {
      id: 'bullhorn-analytics',
      name: 'Bullhorn Analytics',
      description: 'Access Bullhorn Analytics reports and insights',
      enabled: false,
      locked: true,
      comingSoon: true
    },
    {
      id: 'bullhorn-time-expense',
      name: 'Bullhorn Time & Expense',
      description: 'Manage time tracking and expense reports',
      enabled: false,
      locked: true,
      comingSoon: true
    },
    {
      id: 'bullhorn-talent-platform',
      name: 'Bullhorn Talent Platform',
      description: 'Access talent acquisition and management features',
      enabled: false,
      locked: true,
      comingSoon: true
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
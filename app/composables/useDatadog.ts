export const useDatadog = () => {
  const nuxtApp = useNuxtApp()
  const $datadog = nuxtApp.$datadog
  
  // Return no-op functions if Datadog is not available
  if (!$datadog) {
    console.warn('Datadog is not initialized')
    return {
      trackUserSignup: () => {},
      trackMessageSent: () => {},
      trackChatNavigation: () => {},
      trackPageView: () => {},
      trackApiError: () => {},
      trackPerformance: () => {},
      setUserContext: () => {}
    }
  }

  // Track user signup
  const trackUserSignup = (provider: string, userId?: string) => {
    $datadog.trackAction('user_signup', {
      provider,
      userId: userId ? btoa(userId) : undefined, // Base64 encode for privacy
      timestamp: new Date().toISOString()
    })
    
    $datadog.logs.logger.info('New user signup', {
      provider,
      userId: userId ? btoa(userId) : undefined
    })
  }

  // Track chat message sent
  const trackMessageSent = (chatId: string, messageLength: number, role: 'user' | 'assistant' = 'user') => {
    $datadog.trackAction('message_sent', {
      chatId,
      messageLength,
      role,
      timestamp: new Date().toISOString()
    })
  }

  // Track chat navigation
  const trackChatNavigation = (chatId: string, chatCreatedAt: string, source: 'sidebar' | 'direct' = 'sidebar') => {
    const chatAge = Date.now() - new Date(chatCreatedAt).getTime()
    const chatAgeInDays = Math.floor(chatAge / (1000 * 60 * 60 * 24))
    
    $datadog.trackAction('chat_navigation', {
      chatId,
      chatAge,
      chatAgeInDays,
      source,
      timestamp: new Date().toISOString()
    })
  }

  // Track page view (custom implementation)
  const trackPageView = (pageName: string, pageUrl?: string) => {
    $datadog.trackAction('page_view', {
      pageName,
      pageUrl: pageUrl || window.location.href,
      timestamp: new Date().toISOString()
    })
  }

  // Track API errors
  const trackApiError = (endpoint: string, error: any, statusCode?: number) => {
    $datadog.trackError(error instanceof Error ? error : new Error(String(error)), {
      endpoint,
      statusCode,
      timestamp: new Date().toISOString()
    })
  }

  // Track performance metrics
  const trackPerformance = (metricName: string, duration: number) => {
    $datadog.trackTiming(metricName, duration)
  }

  // Set user context
  const setUserContext = (user: { id: string; email?: string; name?: string }) => {
    $datadog.setUser({
      id: btoa(user.id), // Base64 encode for privacy
      email: user.email,
      name: user.name
    })
  }

  return {
    trackUserSignup,
    trackMessageSent,
    trackChatNavigation,
    trackPageView,
    trackApiError,
    trackPerformance,
    setUserContext
  }
}
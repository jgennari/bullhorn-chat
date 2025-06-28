import { datadogRum } from '@datadog/browser-rum'
import { datadogLogs } from '@datadog/browser-logs'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  // Check if required configuration is present
  if (!config.public.datadogApplicationId || !config.public.datadogClientToken) {
    console.warn('Datadog configuration is missing. Skipping initialization.')
    console.log('Config values:', {
      applicationId: config.public.datadogApplicationId,
      clientToken: config.public.datadogClientToken,
      site: config.public.datadogSite
    })
    return {}
  }

  // Initialize Datadog RUM (Real User Monitoring)
  datadogRum.init({
    applicationId: config.public.datadogApplicationId,
    clientToken: config.public.datadogClientToken,
    site: config.public.datadogSite,
    service: config.public.datadogServiceName,
    env: config.public.datadogEnv,
    version: '1.0.0',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input',
    trackFrustrations: true,
    enableExperimentalFeatures: ['clickmap']
  })

  // Start session replay recording
  datadogRum.startSessionReplayRecording()

  // Initialize Datadog Logs
  datadogLogs.init({
    clientToken: config.public.datadogClientToken,
    site: config.public.datadogSite,
    service: config.public.datadogServiceName,
    env: config.public.datadogEnv,
    forwardErrorsToLogs: true,
    sessionSampleRate: 100
  })

  // Make Datadog available globally for custom tracking
  return {
    provide: {
      datadog: {
        rum: datadogRum,
        logs: datadogLogs,
        // Helper methods for custom tracking
        trackAction: (name: string, context?: Record<string, any>) => {
          datadogRum.addAction(name, context)
        },
        trackError: (error: Error, context?: Record<string, any>) => {
          datadogRum.addError(error, context)
        },
        trackTiming: (name: string, duration: number) => {
          datadogRum.addTiming(name, duration)
        },
        setUser: (user: { id?: string; name?: string; email?: string }) => {
          datadogRum.setUser(user)
        },
        addUserAction: (name: string, context?: Record<string, any>) => {
          datadogRum.addAction(name, context)
        }
      }
    }
  }
})
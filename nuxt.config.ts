// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui-pro',
    '@nuxtjs/mdc',
    '@nuxthub/core',
    'nuxt-auth-utils'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  mdc: {
    highlight: {
      // noApiRoute: true
      shikiEngine: 'javascript'
    }
  },

  future: {
    compatibilityVersion: 4
  },

  experimental: {
    viewTransition: true
  },

  compatibilityDate: '2025-01-01',
  
  nitro: {
    preset: 'cloudflare-module',
    experimental: {
      openAPI: true
    },
    routeRules: {
      '/api/chats/**': {
        // Increase timeout for chat endpoints (5 minutes)
        // Note: This may be limited by your hosting provider
        cors: true
      }
    }
  },

  hub: {
    database: true,
    workers: true
  },

  runtimeConfig: {
    public: {
      datadogApplicationId: '',
      datadogClientToken: '',
      datadogSite: 'datadoghq.com',
      datadogServiceName: 'bullhorn-chat',
      datadogEnv: 'development'
    }
  },

  vite: {
    optimizeDeps: {
      include: ['debug'],
      esbuildOptions: {
        target: 'node18'
      }
    },

    $server: {
      build: {
        rollupOptions: {
          output: {
            preserveModules: true
          }
        }
      }
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})

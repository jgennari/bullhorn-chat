// auth.d.ts
declare module '#auth-utils' {
  interface User {
    id: string
    name: string
    email: string
    avatar: string
    username: string
    provider: 'bullhorn'
    providerId: number
    corpId?: number
    userType?: 'user' | 'admin'
    corporationName?: string
    corporationPrompt?: string
  }
}

export {}

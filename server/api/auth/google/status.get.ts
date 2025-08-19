import { eventHandler } from 'h3'
import { eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user?.id) {
    return {
      authenticated: false,
      connected: false
    }
  }
  
  const db = useDrizzle()
  
  // Get user's Google auth status
  const user = await db.query.users.findFirst({
    where: (user, { eq }) => eq(user.id, session.user!.id),
    columns: {
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiresAt: true,
      googleEmail: true
    }
  })
  
  if (!user?.googleAccessToken || !user?.googleRefreshToken) {
    return {
      authenticated: true,
      connected: false
    }
  }
  
  // Check if token is expired
  const now = new Date()
  let expiresAt: Date | null = null
  let isExpired = true
  
  if (user.googleTokenExpiresAt) {
    try {
      expiresAt = new Date(user.googleTokenExpiresAt)
      isExpired = now >= expiresAt
    } catch (e) {
      console.error('Invalid token expiration date:', user.googleTokenExpiresAt)
      expiresAt = null
      isExpired = true
    }
  }
  
  // If expired but we have refresh token, we can still consider it connected
  // The token will be refreshed when needed
  const isConnected = !!user.googleRefreshToken
  
  return {
    authenticated: true,
    connected: isConnected,
    email: user.googleEmail,
    expiresAt: expiresAt && !isNaN(expiresAt.getTime()) ? expiresAt.toISOString() : null,
    needsRefresh: isExpired
  }
})
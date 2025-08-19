import { eventHandler, createError } from 'h3'
import { ofetch } from 'ofetch'
import { eq } from 'drizzle-orm'

// Cache client credentials
let googleClientId: string | null = null
let googleClientSecret: string | null = null

async function getGoogleClient(): Promise<{ clientId: string; clientSecret: string }> {
  // Return cached client if available
  if (googleClientId && googleClientSecret) {
    return { clientId: googleClientId, clientSecret: googleClientSecret }
  }

  // Check for pre-configured credentials first (for production)
  if (process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID
    googleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
    return { clientId: googleClientId, clientSecret: googleClientSecret }
  }

  // Try to register a new client (development)
  const baseURL = process.env.NUXT_BASE_URL || 'http://localhost:3001'
  const googleBaseURL = 'https://google.bullhornlabs.app'
  const registrationEndpoint = `${googleBaseURL}/oauth2/register`
  
  try {
    const registration = await ofetch(registrationEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Bullhorn-Chat/1.0'
      },
      redirect: 'manual', // Don't follow redirects automatically
      retry: 0, // Disable automatic retries
      body: {
        client_name: 'Bullhorn Chat',
        redirect_uris: [
          `${baseURL}/auth/google`,
          `${baseURL}/auth/google-callback`
        ],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_post',
        application_type: 'web'
      }
    })

    if (!registration || !registration.client_id) {
      throw new Error('Invalid registration response')
    }

    googleClientId = registration.client_id
    googleClientSecret = registration.client_secret
    
    return { 
      clientId: googleClientId, 
      clientSecret: googleClientSecret 
    }
  } catch (error) {
    console.error('Failed to get/register Google OAuth client:', error)
    
    if (process.env.NODE_ENV === 'production') {
      throw createError({
        statusCode: 500,
        statusMessage: 'Google OAuth client not configured. Please set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET environment variables.'
      })
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get OAuth client credentials'
    })
  }
}

export default eventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Not authenticated'
    })
  }
  
  const db = useDrizzle()
  
  // Get user's Google tokens
  const user = await db.query.users.findFirst({
    where: (user, { eq }) => eq(user.id, session.user!.id),
    columns: {
      googleRefreshToken: true,
      googleTokenExpiresAt: true
    }
  })
  
  if (!user?.googleRefreshToken) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No Google refresh token found'
    })
  }
  
  // Get client credentials
  const { clientId, clientSecret } = await getGoogleClient()
  
  const googleBaseURL = 'https://google.bullhornlabs.app'
  const tokenURL = `${googleBaseURL}/oauth2/token`
  
  try {
    // Refresh the token
    const tokenResponse = await ofetch(tokenURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: user.googleRefreshToken,
        client_id: clientId,
        client_secret: clientSecret
      })
    })
    
    const { access_token, expires_in, refresh_token } = tokenResponse
    
    if (!access_token) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to refresh Google token'
      })
    }
    
    // Calculate new expiration
    const expiresAt = new Date(Date.now() + (expires_in * 1000))
    
    // Update user with new tokens
    const updateData: any = {
      googleAccessToken: access_token,
      googleTokenExpiresAt: expiresAt
    }
    
    // Update refresh token if a new one was provided
    if (refresh_token) {
      updateData.googleRefreshToken = refresh_token
    }
    
    await db.update(tables.users)
      .set(updateData)
      .where(eq(tables.users.id, session.user!.id))
    
    console.log(`Refreshed Google token for user ${session.user!.id}`)
    
    return {
      success: true,
      expiresAt: expiresAt.toISOString()
    }
  } catch (error: any) {
    console.error('Failed to refresh Google token:', error)
    
    // If refresh fails, clear Google tokens
    if (error.statusCode === 400 || error.statusCode === 401) {
      await db.update(tables.users)
        .set({
          googleAccessToken: null,
          googleRefreshToken: null,
          googleTokenExpiresAt: null
        })
        .where(eq(tables.users.id, session.user!.id))
      
      throw createError({
        statusCode: 401,
        statusMessage: 'Google authentication expired. Please reconnect your account.'
      })
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to refresh Google token'
    })
  }
})
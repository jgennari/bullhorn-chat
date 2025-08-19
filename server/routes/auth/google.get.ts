import { eventHandler, getQuery, sendRedirect, createError, setCookie, getCookie } from 'h3'
import { withQuery } from 'ufo'
import { ofetch } from 'ofetch'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'

// Dynamic client registration cache
let googleClientId: string | null = null
let googleClientSecret: string | null = null

async function ensureGoogleClient(baseURL: string): Promise<{ clientId: string; clientSecret: string }> {
  // Return cached client if available
  if (googleClientId && googleClientSecret) {
    return { clientId: googleClientId, clientSecret: googleClientSecret }
  }

  // Check for pre-configured credentials first (for production)
  if (process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID
    googleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
    console.log('Using pre-configured Google OAuth client from environment variables')
    return { clientId: googleClientId, clientSecret: googleClientSecret }
  }

  const googleBaseURL = 'https://google.bullhornlabs.app'
  const registrationEndpoint = `${googleBaseURL}/oauth2/register`
  
  try {
    // Register a new client dynamically
    const registration = await ofetch(registrationEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Bullhorn-Chat/1.0'
      },
      redirect: 'manual', // Don't follow redirects automatically (important for Cloudflare)
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
        application_type: 'web',
        contacts: ['support@bullhorn.com'],
        client_uri: baseURL,
        policy_uri: `${baseURL}/privacy`,
        tos_uri: `${baseURL}/terms`,
        scope: 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/tasks.readonly https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly'
      }
    })

    // Check if we got a redirect response
    if (!registration || !registration.client_id) {
      throw new Error('Invalid registration response from Google OAuth server')
    }

    googleClientId = registration.client_id
    googleClientSecret = registration.client_secret

    console.log('Successfully registered Google OAuth client:', googleClientId)
    
    return { 
      clientId: googleClientId, 
      clientSecret: googleClientSecret 
    }
  } catch (error: any) {
    console.error('Failed to register Google OAuth client:', error)
    
    // If we're in production and registration fails, provide helpful error
    if (process.env.NODE_ENV === 'production') {
      throw createError({
        statusCode: 500,
        statusMessage: 'Google OAuth client registration failed. Please configure GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET environment variables.'
      })
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to register OAuth client with Google'
    })
  }
}

export default eventHandler(async (event) => {
  const query = getQuery(event)
  const db = useDrizzle()
  const session = await getUserSession(event)
  
  const baseURL = process.env.NUXT_BASE_URL || 'http://localhost:3001'
  const googleBaseURL = 'https://google.bullhornlabs.app'
  
  // Ensure we have a registered client
  const { clientId, clientSecret } = await ensureGoogleClient(baseURL)
  
  const redirectURL = `${baseURL}/auth/google`
  const authorizationURL = `${googleBaseURL}/oauth2/authorize`
  const tokenURL = `${googleBaseURL}/oauth2/token`
  
  // Handle OAuth error
  if (query.error) {
    console.error('Google OAuth error:', query.error, query.error_description)
    return sendRedirect(event, '/?error=google_auth_failed')
  }
  
  // Step 1: Redirect to authorization URL
  if (!query.code) {
    // Generate PKCE challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url')
    
    // Store code verifier in a secure cookie
    setCookie(event, 'google_pkce_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10 // 10 minutes
    })
    
    // Store state for security
    const state = crypto.randomBytes(16).toString('base64url')
    setCookie(event, 'google_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10 // 10 minutes
    })
    
    const authParams = {
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectURL,
      scope: 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/tasks.readonly https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/presentations',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline', // Request refresh token
      prompt: 'consent' // Force consent to get refresh token
    }
    
    return sendRedirect(event, withQuery(authorizationURL, authParams))
  }
  
  // Step 2: Exchange code for access token
  try {
    // Verify state parameter for security
    const storedState = getCookie(event, 'google_oauth_state')
    if (!storedState || query.state !== storedState) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid state parameter'
      })
    }
    
    // Clear state cookie
    setCookie(event, 'google_oauth_state', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0
    })
    
    // Get the PKCE verifier from cookie
    const codeVerifier = getCookie(event, 'google_pkce_verifier')
    if (!codeVerifier) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing PKCE code verifier'
      })
    }
    
    // Clear the PKCE cookie
    setCookie(event, 'google_pkce_verifier', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0
    })
    
    // Exchange authorization code for access token
    const tokenResponse = await ofetch(tokenURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: query.code as string,
        redirect_uri: redirectURL,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: codeVerifier
      })
    })
    
    const { access_token, refresh_token, id_token, expires_in } = tokenResponse
    
    console.log('Google token response received:', { 
      has_access_token: !!access_token, 
      has_refresh_token: !!refresh_token,
      has_id_token: !!id_token,
      expires_in
    })
    
    if (!access_token) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to obtain access token from Google'
      })
    }
    
    // Decode ID token to get user info
    let userInfo: any = null
    
    if (id_token) {
      try {
        const payload = JSON.parse(Buffer.from(id_token.split('.')[1], 'base64').toString())
        userInfo = payload
        console.log('Got user info from ID token:', { 
          sub: payload.sub, 
          email: payload.email, 
          name: payload.name,
          picture: payload.picture
        })
      } catch (e) {
        console.error('Failed to decode ID token:', e)
      }
    }
    
    // If no ID token or failed to decode, get user info from API
    if (!userInfo || !userInfo.email) {
      try {
        userInfo = await ofetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${access_token}`
          }
        })
        console.log('Got user info from userinfo endpoint:', { 
          id: userInfo.id,
          email: userInfo.email, 
          name: userInfo.name
        })
      } catch (e) {
        console.error('Failed to get userinfo:', e)
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to retrieve user information from Google'
        })
      }
    }
    
    // Ensure we have required user info
    if (!userInfo.email) {
      throw createError({
        statusCode: 500,
        statusMessage: 'No email found in Google authentication response'
      })
    }
    
    // Calculate token expiration
    const expiresAt = new Date(Date.now() + (expires_in * 1000))
    
    // Get or update the current user to add Google auth
    if (!session.user?.id) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Must be logged in to connect Google account'
      })
    }
    
    // Update user with Google tokens
    await db.update(tables.users)
      .set({
        googleAccessToken: access_token,
        googleRefreshToken: refresh_token,
        googleTokenExpiresAt: expiresAt,
        googleEmail: userInfo.email
      })
      .where(eq(tables.users.id, session.user.id))
    
    console.log(`Updated user ${session.user.id} with Google authentication`)
    
    // Update session
    await setUserSession(event, { 
      user: {
        ...session.user,
        googleEmail: userInfo.email
      }
    })
    
    return sendRedirect(event, '/?google_connected=true')
  } catch (error: any) {
    console.error('Google OAuth error:', error)
    
    // More specific error messages
    if (error.statusCode === 400) {
      return sendRedirect(event, '/?error=invalid_oauth_state')
    }
    
    return sendRedirect(event, '/?error=google_auth_failed')
  }
})
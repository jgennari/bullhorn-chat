import { eventHandler, getQuery, sendRedirect, createError, setCookie, getCookie, getHeader } from 'h3'
import { withQuery } from 'ufo'
import { ofetch } from 'ofetch'
import { eq, and } from 'drizzle-orm'
import crypto from 'crypto'

export default eventHandler(async (event) => {
  const config = useRuntimeConfig()
  const query = getQuery(event)
  const db = useDrizzle()
  const session = await getUserSession(event)
  
  // Configuration
  const clientId = config.oauth?.bullhorn?.clientId || process.env.NUXT_OAUTH_BULLHORN_CLIENT_ID
  const clientSecret = config.oauth?.bullhorn?.clientSecret || process.env.NUXT_OAUTH_BULLHORN_CLIENT_SECRET
  
  // Use the request origin to build the redirect URL
  const host = getHeader(event, 'host')
  const protocol = getHeader(event, 'x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https')
  const redirectURL = `${protocol}://${host}/auth/bullhorn`
  
  const authorizationURL = 'https://mcp.bullhornlabs.app/authorize'
  const tokenURL = 'https://mcp.bullhornlabs.app/token'
  
  if (!clientId || !clientSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing Bullhorn OAuth configuration'
    })
  }
  
  // Handle OAuth error
  if (query.error) {
    console.error('Bullhorn OAuth error:', query.error, query.error_description)
    return sendRedirect(event, '/')
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
    setCookie(event, 'pkce_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10 // 10 minutes
    })
    
    const authParams = {
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectURL,
      scope: 'read write',
      state: session.id, // Use session ID as state for security
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    }
    
    return sendRedirect(event, withQuery(authorizationURL, authParams))
  }
  
  // Step 2: Exchange code for access token
  try {
    // Verify state parameter for security
    if (query.state !== session.id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid state parameter'
      })
    }
    
    // Get the PKCE verifier from cookie
    const codeVerifier = getCookie(event, 'pkce_verifier')
    if (!codeVerifier) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing PKCE code verifier'
      })
    }
    
    // Clear the PKCE cookie
    setCookie(event, 'pkce_verifier', '', {
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
    
    const { access_token, id_token } = tokenResponse
    
    if (!access_token) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to obtain access token'
      })
    }
    
    // Get user info from ID token or userinfo endpoint
    let userInfo: any = {}
    
    if (id_token) {
      // Decode ID token (without verification for now - in production, verify the JWT)
      const payload = JSON.parse(Buffer.from(id_token.split('.')[1], 'base64').toString())
      userInfo = payload
    } else {
      // Fallback to userinfo endpoint if available
      try {
        userInfo = await ofetch('https://mcp.bullhornlabs.app/userinfo', {
          headers: {
            Authorization: `Bearer ${access_token}`
          }
        })
      } catch (e) {
        // If userinfo fails, use minimal info
        userInfo = {
          sub: 'bullhorn-user',
          email: 'user@bullhorn.com',
          name: 'Bullhorn User'
        }
      }
    }
    
    // Find or create user
    let user = await db.query.users.findFirst({
      where: (user, { eq }) => and(
        eq(user.provider, 'bullhorn'),
        eq(user.providerId, parseInt(userInfo.sub) || 0)
      )
    })
    
    if (!user) {
      // Create new user
      user = await db.insert(tables.users).values({
        id: session.id, // Use session ID as user ID for continuity
        name: userInfo.name || userInfo.preferred_username || 'Bullhorn User',
        email: userInfo.email || `${userInfo.sub}@bullhorn.com`,
        avatar: userInfo.picture || 'https://ui-avatars.com/api/?name=Bullhorn+User',
        username: userInfo.preferred_username || userInfo.sub || 'bullhorn-user',
        provider: 'bullhorn',
        providerId: parseInt(userInfo.sub) || 0,
        accessToken: access_token
      }).returning().get()
    } else {
      // Update existing user's access token
      await db.update(tables.users)
        .set({ accessToken: access_token })
        .where(eq(tables.users.id, user.id))
      
      // Migrate anonymous chats to authenticated user
      await db.update(tables.chats)
        .set({ userId: user.id })
        .where(eq(tables.chats.userId, session.id))
    }
    
    // Set user session
    await setUserSession(event, { user })
    
    return sendRedirect(event, '/')
  } catch (error) {
    console.error('Bullhorn OAuth error:', error)
    return sendRedirect(event, '/')
  }
})
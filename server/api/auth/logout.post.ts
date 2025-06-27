import { eventHandler, createError } from 'h3'
import { ofetch } from 'ofetch'
import { eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Not authenticated'
    })
  }

  const db = useDrizzle()

  // Get the user's access token from the database
  const user = await db.query.users.findFirst({
    where: (user, { eq }) => eq(user.id, session.user!.id),
    columns: {
      accessToken: true,
      provider: true
    }
  })

  if (!user || user.provider !== 'bullhorn') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid user or provider'
    })
  }

  // If user has an access token, revoke it
  if (user.accessToken) {
    try {
      const clientId = process.env.NUXT_OAUTH_BULLHORN_CLIENT_ID
      const clientSecret = process.env.NUXT_OAUTH_BULLHORN_CLIENT_SECRET

      if (!clientId || !clientSecret) {
        console.error('Missing Bullhorn OAuth configuration for revoke')
      } else {
        // Call the revoke endpoint
        await ofetch('https://mcp.bullhornlabs.app/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            token: user.accessToken,
            client_id: clientId,
            client_secret: clientSecret
          })
        })

        console.log(`Successfully revoked token for user ${session.user!.id}`)
      }
    } catch (error) {
      // Log the error but don't fail the logout
      console.error('Failed to revoke token:', error)
    }

    // Clear the access token from the database
    await db.update(tables.users)
      .set({ accessToken: null })
      .where(eq(tables.users.id, session.user!.id))
  }

  // Clear the session (this is handled by nuxt-auth-utils)
  await clearUserSession(event)

  return { success: true }
})
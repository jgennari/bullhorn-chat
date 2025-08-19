import { eventHandler, createError } from 'h3'
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
  
  // Clear Google tokens from the user record
  await db.update(tables.users)
    .set({
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiresAt: null,
      googleEmail: null
    })
    .where(eq(tables.users.id, session.user!.id))
  
  console.log(`Disconnected Google account for user ${session.user!.id}`)
  
  // Update session to remove Google email
  if (session.user.googleEmail) {
    const updatedUser = { ...session.user }
    delete updatedUser.googleEmail
    await setUserSession(event, { user: updatedUser })
  }
  
  return {
    success: true,
    message: 'Google account disconnected successfully'
  }
})
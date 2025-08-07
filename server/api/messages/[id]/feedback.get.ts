import { feedback } from '../../../database/schema'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  try {
    const session = await getUserSession(event)
    if (!session?.user?.id) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      })
    }

  const { id: messageId } = getRouterParams(event)

  // Get feedback for this message and user
  const userFeedback = await useDrizzle().select()
    .from(feedback)
    .where(
      and(
        eq(feedback.messageId, messageId),
        eq(feedback.userId, session.user.id)
      )
    )
    .limit(1)

  return userFeedback[0] || null
  } catch (error) {
    console.error('[Feedback GET API] Error:', error)
    // Don't throw for GET requests, just return null
    return null
  }
})
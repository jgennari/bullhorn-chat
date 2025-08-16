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
  
  if (!messageId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Message ID is required'
    })
  }

  // Get feedback for this message and user
  const userFeedback = await useDrizzle().select()
    .from(feedback)
    .where(
      and(
        eq(feedback.messageId, messageId as string),
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
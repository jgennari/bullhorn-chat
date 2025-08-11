import { feedback } from '../../../database/schema'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  let session: any
  let messageId: string | undefined
  let rating: string | undefined
  let comment: string | undefined
  
  try {
    session = await getUserSession(event)
    if (!session?.user?.id) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      })
    }

    const params = getRouterParams(event)
    messageId = params.id
    const body = await readBody(event)
    rating = body.rating
    // Normalize comment - treat empty strings as null
    comment = body.comment && body.comment.trim() ? body.comment.trim() : null

    if (!rating || !['positive', 'negative'].includes(rating)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid rating. Must be "positive" or "negative"'
      })
    }

    console.log('[Feedback API] Processing feedback:', { messageId, userId: session.user.id, rating })

  // Check if feedback already exists for this user and message
  const existingFeedback = await useDrizzle().select()
    .from(feedback)
    .where(
      and(
        eq(feedback.messageId, messageId),
        eq(feedback.userId, session.user.id)
      )
    )
    .limit(1)

  if (existingFeedback.length > 0) {
    // Update existing feedback
    const [updated] = await useDrizzle().update(feedback)
      .set({
        rating,
        comment
      })
      .where(eq(feedback.id, existingFeedback[0].id))
      .returning()

    return updated
  } else {
    // Create new feedback
    const [created] = await useDrizzle().insert(feedback)
      .values({
        messageId,
        userId: session.user.id,
        rating,
        comment
      })
      .returning()

    return created
  }
  } catch (error: any) {
    console.error('[Feedback API] Error:', {
      message: error.message,
      cause: error.cause,
      stack: error.stack,
      messageId,
      userId: session?.user?.id,
      rating,
      comment
    })
    
    // If it's already an error with statusCode, re-throw it
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to save feedback: ${error.message || 'Unknown error'}`
    })
  }
})
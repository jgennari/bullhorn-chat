import { feedback } from '../../../database/schema'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const { id: messageId } = getRouterParams(event)
  const body = await readBody(event)
  const { rating, comment } = body

  if (!rating || !['positive', 'negative'].includes(rating)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid rating. Must be "positive" or "negative"'
    })
  }

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
        comment: comment || null,
        createdAt: new Date()
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
        comment: comment || null
      })
      .returning()

    return created
  }
})
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional()
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session.user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Not authenticated'
    })
  }
  
  const body = await readBody(event)
  const validatedData = updateUserSchema.parse(body)
  
  const db = useDrizzle()
  const userId = session.user.id
  
  // Update user
  const [updatedUser] = await db
    .update(users)
    .set({
      ...validatedData,
      updatedAt: new Date()
    })
    .where(eq(users.id, userId))
    .returning()
  
  if (!updatedUser) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found'
    })
  }
  
  return {
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email
  }
})
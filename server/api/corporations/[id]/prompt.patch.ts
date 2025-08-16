export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session.user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Not authenticated'
    })
  }
  
  const db = useDrizzle()
  
  // Get the corporation ID from the route params
  const { id: corpId } = getRouterParams(event)
  
  if (!corpId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Corporation ID is required'
    })
  }
  
  // Get the prompt from the request body
  const { prompt } = await readBody(event)
  
  // Verify the user is an admin of this corporation
  const user = await db.query.users.findFirst({
    where: (user, { eq, and }) => and(
      eq(user.id, session.user.id),
      eq(user.corpId, parseInt(corpId as string)),
      eq(user.userType, 'admin')
    )
  })
  
  if (!user) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You must be an admin of this corporation to update its prompt'
    })
  }
  
  // Update the corporation prompt
  try {
    await db.update(tables.corporations)
      .set({ prompt: prompt || null })
      .where(eq(tables.corporations.id, parseInt(corpId as string)))
    
    return { success: true, message: 'Corporation prompt updated successfully' }
  } catch (error) {
    console.error('Failed to update corporation prompt:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update corporation prompt'
    })
  }
})
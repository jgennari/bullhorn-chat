export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  
  if (!session.user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Not authenticated'
    })
  }
  
  const db = useDrizzle()
  const userId = session.user.id
  
  // Fetch user with corporation data
  const userWithCorp = await db.query.users.findFirst({
    where: (user, { eq }) => eq(user.id, userId),
    with: {
      corporation: true
    }
  })
  
  if (!userWithCorp) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found'
    })
  }
  
  // Return user data with corporation info
  return {
    id: userWithCorp.id,
    email: userWithCorp.email,
    name: userWithCorp.name,
    avatar: userWithCorp.avatar,
    username: userWithCorp.username,
    provider: userWithCorp.provider,
    providerId: userWithCorp.providerId,
    corpId: userWithCorp.corpId,
    userType: userWithCorp.userType,
    corporationName: userWithCorp.corporation?.name || null,
    corporationPrompt: userWithCorp.corporation?.prompt || null
  }
})
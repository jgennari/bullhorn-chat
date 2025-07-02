import OpenAI from 'openai'

defineRouteMeta({
  openAPI: {
    description: 'Chat with AI.',
    tags: ['ai']
  }
})


export default defineEventHandler(async (event) => {
  try {
    const session = await getUserSession(event)

    const { id } = getRouterParams(event)
    console.log(`[API] Processing request for chat ID: ${id}`)
    
    const body = await readBody(event)
    const { model, messages: rawMessages } = body

    // Transform messages to the format expected by the AI SDK
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages = rawMessages.map((msg: any) => ({
      role: msg.role,
      content: typeof msg.content === 'string'
        ? msg.content
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : msg.parts?.find((part: any) => part.type === 'text')?.text || msg.content
    }))

    const db = useDrizzle()

    // Check for OpenAI API key
    const apiKey = process.env.NUXT_OPENAI_API_KEY
    if (!apiKey) {
      throw createError({ statusCode: 500, statusMessage: 'OpenAI API key not configured' })
    }

    // Create OpenAI instance
    const openai = new OpenAI({
      apiKey: apiKey
    })

    const chat = await db.query.chats.findFirst({
      where: (chat, { eq }) => and(eq(chat.id, id as string), eq(chat.userId, session.user?.id || session.id)),
      with: {
        messages: true
      }
    })

    if (!chat) {
      console.error(`Chat not found with ID: ${id}`)
      throw createError({ statusCode: 404, statusMessage: 'Chat not found' })
    }
    
    console.log(`Processing chat ${id}, title: "${chat.title}", messages: ${chat.messages.length}`)

    // Get the latest message
    const lastMessage = messages[messages.length - 1]

    // Fire-and-forget title generation
    if (!chat.title) {
      // No await - runs in background
      (async () => {
        try {
          const titleResponse = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{
              role: 'system',
              content: `Generate a short title (max 30 chars) for a chat that starts with: "${lastMessage.content}". No quotes or punctuation. Keep it professional and concise.`
            }],
            max_tokens: 20
          })
          const title = titleResponse.choices[0]?.message?.content || 'Untitled'

          // Clean the title and save to database
          const cleanedTitle = title.replace(/:/g, '').split('\n')[0]
          await db.update(tables.chats).set({ title: cleanedTitle }).where(eq(tables.chats.id, id as string))
          console.log(`Title generated for chat ${id}: ${cleanedTitle}`)
        } catch (e) {
          console.log('Error generating title:', e)
        }
      })().catch(e => console.error('Background title generation error:', e))
    }

    // Save user message if it's new
    if (lastMessage.role === 'user' && messages.length > chat.messages.length) {
      await db.insert(tables.messages).values({
        chatId: id as string,
        role: 'user',
        content: lastMessage.content
      })
    }

    // Get user's access token if authenticated
    let accessToken: string | null = null
    if (session.user?.id) {
      const userId = session.user.id
      const user = await db.query.users.findFirst({
        where: (user, { eq }) => eq(user.id, userId),
        columns: {
          accessToken: true
        }
      })
      accessToken = user?.accessToken || null
    }

    // Use OpenAI Responses API with persistence
    // Based on the SDK examples, the Responses API is accessed directly on the openai instance
    let responseId: string | undefined

    // Build tools configuration with headers if authenticated
    const mcpBaseURL = process.env.NUXT_BULLHORN_MCP_URL || 'https://mcp.bullhornlabs.app'
    const tools: any[] = [{
      type: 'mcp',
      server_label: 'Bullhorn',
      server_url: `${mcpBaseURL}/sse`,
      require_approval: "never"
    },
    { type: "web_search_preview" }];

    // Add authorization header if user has an access token
    if (accessToken) {
      tools[0].headers = {
        'Authorization': `Bearer ${accessToken}`
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runner = (openai as any).responses.stream({
      model: model || 'gpt-4.1',
      input: lastMessage.content,
        prompt: {
        "id": "pmpt_68650b0f9c208194aefe5d11b912ecfb03d932dccc73bd13"
      },
      tools: tools,
      previous_response_id: chat.lastResponseId || undefined
    })

    const encoder = new TextEncoder()
    let fullText = ''

    // Create a stream that converts OpenAI's format to Vercel AI SDK format
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Handle streaming events
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          runner.on('response.output_text.delta', (diff: any) => {
            const content = diff.delta
            fullText += content
            // Send in Vercel AI SDK format
            controller.enqueue(encoder.encode(`0:"${content.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"\n`))
          })

          // Listen for response.done event to get the ID
          runner.on('response.done', (response: any) => {
            if (response?.id) {
              responseId = response.id
            }
          })

          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
          runner.on('response.output_text.done', (_text: any) => {
            // Try to get from currentResponse as well
            if (!responseId && runner.currentResponse?.id) {
              responseId = runner.currentResponse.id
            }
          })

          // Wait for the stream to complete
          const finalResponse = await runner.finalResponse()

          // Try to get response ID from finalResponse if not already set
          if (!responseId && finalResponse?.id) {
            responseId = finalResponse.id
          }

          // Save the complete message and update the response ID
          if (fullText) {
            try {
              await db.insert(tables.messages).values({
                chatId: id as string,
                role: 'assistant',
                content: fullText
              })
            } catch (insertError) {
              console.error(`Failed to insert assistant message for chat ${id}:`, insertError)
              // Don't throw, just log the error to avoid breaking the stream
            }

            // Update the chat with the response ID for future conversations
            if (responseId) {
              await db.update(tables.chats)
                .set({ lastResponseId: responseId })
                .where(eq(tables.chats.id, id as string))
            }
          } else {
            // If no text was generated, still capture the response ID
            if (responseId) {
              await db.update(tables.chats)
                .set({ lastResponseId: responseId })
                .where(eq(tables.chats.id, id as string))
            }
          }

          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          controller.error(error)
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Vercel-AI-Data-Stream': 'v1'
      }
    })
  } catch (error) {
    console.error('Chat API Error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'An error occurred processing your request'
    })
  }
})

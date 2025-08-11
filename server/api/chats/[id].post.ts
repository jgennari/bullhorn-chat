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
    const { messages: rawMessages } = body

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

    // Create OpenAI instance with timeout configuration
    const openai = new OpenAI({
      apiKey: apiKey,
      timeout: 300000, // 5 minutes timeout (default is 10 minutes, but let's be explicit)
      maxRetries: 2 // Retry up to 2 times on timeout or transient errors
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
            model: 'gpt-4o',
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

    if (!process.env.NUXT_OPENAI_PROMPT_ID) {
      throw createError({
        statusCode: 500,
        statusMessage: 'OpenAI prompt ID not configured. Please set NUXT_OPENAI_PROMPT_ID environment variable.'
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runner = (openai as any).responses.stream({
      input: lastMessage.content,
      prompt: {
        "id": process.env.NUXT_OPENAI_PROMPT_ID
      },
      tools: tools,
      max_output_tokens: 32000,
      previous_response_id: chat.lastResponseId || undefined,
      text: {
        "format": {
          "type": "text"
        },
        "verbosity": "low"
      },
      store: true    
    });

    const encoder = new TextEncoder()
    let fullText = ''
    let isFirstChunk = true
    let hasSeenContent = false

    // Create a stream that converts OpenAI's format to Vercel AI SDK format
    const stream = new ReadableStream({
      async start(controller) {
        let isStreamClosed = false
        
        // Handle stream closure gracefully
        const closeStream = () => {
          if (!isStreamClosed) {
            isStreamClosed = true
            console.log(`[Stream] Closing stream. Total text length: ${fullText.length}`)
            try {
              controller.close()
            } catch (e) {
              // Stream already closed, ignore
              console.log('Stream already closed:', e.message)
            }
          }
        }
        
        try {
          // Log all events for debugging
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          runner.on('*', (eventName: string, data: any) => {
            console.log(`[OpenAI Event] ${eventName}:`, JSON.stringify(data, null, 2))
          })

          /* 
           * MCP Tool Event Flow:
           * 1. mcp_list_tools - Imports available tools from MCP server
           * 2. mcp_tool_call - Initiates a tool call
           * 3. mcp_approval_requested - (if require_approval is set) Requests approval
           * 4. tool_called - Generic tool invocation event
           * 5. tool_output - Tool returns its result
           */

          // MCP-specific events
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          runner.on('mcp_list_tools', (data: any) => {
            console.log('[MCP] List Tools Event:', {
              timestamp: new Date().toISOString(),
              data: JSON.stringify(data, null, 2)
            })
          })

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          runner.on('mcp_tool_call', (data: any) => {
            console.log('[MCP] Tool Call Event:', {
              timestamp: new Date().toISOString(),
              toolName: data?.tool_name,
              data: JSON.stringify(data, null, 2)
            })
          })

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          runner.on('mcp_approval_requested', (data: any) => {
            console.log('[MCP] Approval Requested:', {
              timestamp: new Date().toISOString(),
              toolName: data?.tool_name,
              data: JSON.stringify(data, null, 2)
            })
          })

          // Generic tool events
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          runner.on('tool_called', (data: any) => {
            console.log('[Tool] Called:', {
              timestamp: new Date().toISOString(),
              toolName: data?.name || data?.tool_name,
              data: JSON.stringify(data, null, 2)
            })
          })

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          runner.on('tool_output', (data: any) => {
            console.log('[Tool] Output:', {
              timestamp: new Date().toISOString(),
              toolName: data?.name || data?.tool_name,
              output: data?.output,
              data: JSON.stringify(data, null, 2)
            })
          })

          // Handle content part added events to detect when LLM resumes after pausing
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          runner.on('response.content_part.added', (part: any) => {
            console.log('[Content Part Added]', { hasSeenContent, part })
            // If we've already seen content and a new part is added, 
            // this likely means the LLM paused and is resuming
            if (hasSeenContent) {
              // Add a double newline for a paragraph break
              const paragraphBreak = '\n\n'
              fullText += paragraphBreak
              const escapedBreak = JSON.stringify(paragraphBreak)
              controller.enqueue(encoder.encode(`0:${escapedBreak}\n`))
            }
          })

          // Handle streaming events
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          runner.on('response.output_text.delta', (diff: any) => {
            if (isStreamClosed) return // Don't write to closed stream
            
            const content = diff.delta
            
            // Mark that we've seen content
            if (content.length > 0) {
              hasSeenContent = true
              isFirstChunk = false
            }
            
            fullText += content
            console.log(`[Stream Delta] Received ${content.length} chars, total so far: ${fullText.length}`)
            
            // Send in Vercel AI SDK format with proper escaping
            const escaped = JSON.stringify(content)
            const chunk = `0:${escaped}\n`
            try {
              controller.enqueue(encoder.encode(chunk))
            } catch (e) {
              console.error('[Stream] Failed to enqueue:', e)
              closeStream()
            }
          })

          // Listen for response.done event to get the ID
          runner.on('response.done', (response: any) => {
            if (response?.id) {
              responseId = response.id
              console.log(`[Response] Captured response ID: ${responseId}`)
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
          console.log('[Stream] Waiting for finalResponse...')
          const finalResponse = await runner.finalResponse()
          console.log('[Stream] Got finalResponse:', {
            hasId: !!finalResponse?.id,
            responseId: finalResponse?.id,
            fullTextLength: fullText.length
          })

          // Try to get response ID from finalResponse if not already set
          if (!responseId && finalResponse?.id) {
            responseId = finalResponse.id
          }

          // Save the complete message and update the response ID
          if (fullText) {
            console.log(`[Save] Attempting to save response for chat ${id}, length: ${fullText.length} chars, responseId: ${responseId}`)
            try {
              await db.insert(tables.messages).values({
                chatId: id as string,
                role: 'assistant',
                content: fullText,
                responseId: responseId || null
              })
              console.log(`[Save] Successfully saved response for chat ${id} with responseId: ${responseId}`)
            } catch (insertError) {
              console.error(`[Save] Failed to insert assistant message for chat ${id}:`, insertError)
              console.error(`[Save] Message length was: ${fullText.length} chars`)
              // Don't throw, just log the error to avoid breaking the stream
            }

            // Update the chat with the response ID for future conversations
            if (responseId) {
              console.log(`[Save] Updating chat ${id} with response ID: ${responseId}`)
              await db.update(tables.chats)
                .set({ lastResponseId: responseId })
                .where(eq(tables.chats.id, id as string))
            } else {
              console.warn(`[Save] No response ID to save for chat ${id}`)
            }
          } else {
            // If no text was generated, still capture the response ID
            if (responseId) {
              await db.update(tables.chats)
                .set({ lastResponseId: responseId })
                .where(eq(tables.chats.id, id as string))
            }
          }

          // Send an explicit end-of-stream marker before closing
          if (!isStreamClosed) {
            try {
              // Log the response ID and message length on server side
              if (responseId) {
                console.log('[Stream] Final response ID:', responseId)
              }
              console.log('[Stream] Final message length:', fullText.length)
              
              // Send the standard finish marker
              const finishData = {
                finishReason: "stop"
              }
              console.log('[Stream] Sending finish marker')
              controller.enqueue(encoder.encode(`d:${JSON.stringify(finishData)}\n`))
            } catch (e) {
              console.log('[Stream] Failed to send end marker:', e)
            }
            
            // Close the stream
            closeStream()
          }
        } catch (error: any) {
          console.error('Streaming error:', error)
          
          // Handle timeout errors specifically
          if (error?.message?.includes('timeout') || error?.code === 'ETIMEDOUT' || error?.code === 'ECONNABORTED') {
            console.error('OpenAI request timed out. The service may be slow.')
            const timeoutError = new Error('OpenAI is taking longer than expected. Please try again.')
            controller.error(timeoutError)
          } else {
            controller.error(error)
          }
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Vercel-AI-Data-Stream': 'v1',
        // HTTP/2 and streaming optimizations
        'Cache-Control': 'no-cache, no-transform',
        'X-Content-Type-Options': 'nosniff',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no' // Disable proxy buffering for better streaming
      }
    })
  } catch (error: any) {
    console.error('Chat API Error:', error)
    
    // Check for timeout errors
    if (error?.message?.includes('timeout') || error?.code === 'ETIMEDOUT' || error?.code === 'ECONNABORTED') {
      throw createError({
        statusCode: 504,
        statusMessage: 'OpenAI request timed out. The service may be experiencing high load. Please try again.'
      })
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'An error occurred processing your request'
    })
  }
})

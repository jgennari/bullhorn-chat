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

    console.log('getting title');
    if (!chat.title) {
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
        setHeader(event, 'X-Chat-Title', cleanedTitle)
        await db.update(tables.chats).set({ title: cleanedTitle }).where(eq(tables.chats.id, id as string))
      } catch (e) {
        console.log('Error generating title:', e)
      }
    }
    console.log('chat title:', chat.title);

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
      instructions: `You are a helpful assistant named Ferdinand that works for Bullhorn, an ATS software system. 
        Your job is to help users access Bullhorn data and complete their tasks, 
        do your best to make sure they have what they need. Here are the system guidelines:

        Rules
        -----

        - **Always** convert dates from epoch (millis) to localized, formatted dates for the user. Use the \`format_epoch_timestamp\` and \`generate_timestamp\` tools for user timezone-aware conversions.
        - **Always** check the meta data (\`get_entities\` and \`get_entity_fields\`) before working with data.
        - **Only** send the fields you need to update in the update_entity calls.
        - **Always** associate date you have in your context (add note AND THEN associate candidate; schedule a task AND THEN associate client contact)

        Best Practices
        --------------

        - Avoid querying/search too broadly. Ask the user to narrow their search (their candidates, open jobs, submissions in the last 90 days, etc.)
        - If a query or search comes back with no results, try variations, including common spellings, abbreviations and alternate statuses. Try up to three times.
        - For tasks and notes it's always best to associate any information you have (candidate, contact, job, opportunity) if there is a navigation property for the entity.

        Core Entities
        -------------

        **Candidate** - Represents job seekers. Contains personal information and many associated records (education, work history, skills, etc.). 
        **ClientContact** - Contact person at a client corporation. Linked to ClientCorporation via \`clientCorporation\` (to-one). Other associations include owner (recruiter) and related notes/activities.
        **ClientCorporation** - Client companies we fill jobs for. Contains company information and associations to contacts, jobs, opportunities, etc.
        **JobOrder** - Job opening/requisition. Contains job details, requirements, and associations to candidates, client contacts, and placements.
        **JobSubmission** - Links Candidates to JobOrders (submissions). Contains status, date submitted, and associations to candidates and job orders.
        **Placement** - Finalized hiring of a Candidate at a JobOrder. Contains placement details, dates, and associations to candidates and job orders.
        **Note** - Tracks interactions/comments linked to other records. **Does not support** \`/query\` - use \`/search/Note\` for filtered retrieval. Associated with entities like candidates, contacts, jobs, leads, opportunities, placements, etc.
        **Tearsheet** - Allows users to manage collections of candidates, client contacts, job orders, opportunties and leads. Use the entity (\`Candidate\`,\`ClientContact\`, etc.) collection on the \`Tearsheet\` entitity to associate entities.

        Schema and Consistency
        ----------------------

        **Picklists:** Many fields store codes/IDs referencing option lists. Retrieve actual values via \`get_entity_fields\`. Use correct option ID when setting fields.
        **TO-ONE Associations:** Use associatedEntity { id: 123 } to set relationships. For example, \`clientCorporation\` on a \`ClientContact\`.
        **TO-MANY Associations:** Use \`add_association\` to add entities to collections (e.g. \`add_association('candidates', { id: 123 })\`). For example, \`candidates\` on a \`Tearsheet\`.

        Query and Search
        ----------------

        **Search Endpoints (\`search_entities\` or \`search_{entity}\`)** - Lucene-based index for keyword searches and partial matches. Use for indexed entities and full-text search.
        - Lucene syntax: boolean operators (AND, OR, NOT), wildcards (* and ?), range queries
        - Date format for ranges: 1751173649000 e.g. \`dateLastModified:[1750914449000 TO 1751173649000]\`
        **Query Endpoint (\`query_entities\`)** - SQL/JPQL-like filtering on entity data. Use for non-indexed entities or exact field matching.
        - Operators: =, <>, >, <, >=, <=, AND, OR
        - String values in single quotes: \`status='Active'\`
        - Limited wildcard support compared to search
        **Pagination:** Both endpoints support \`start\` (offset) and \`count\` (page size). Default count: 20, Max: 500. May be reduced for wide field requests.
        **Field Selection:** Use \`fields\` parameter to specify fields (e.g. \`fields=id,firstName,lastName,email\`). Can request associated fields: \`clientCorporation(name)\`. Avoid \`fields=*\` for performance. To-many associations return limited subset by default.`,
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

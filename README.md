# Bullhorn Chat

An AI-powered chat assistant specifically designed for Bullhorn ATS users. Access your Bullhorn data through natural language conversations, powered by advanced AI models with real-time data integration.

## Overview

Bullhorn Chat provides an intelligent conversational interface to your Bullhorn ATS system, allowing you to query candidates, jobs, clients, and more through simple chat interactions. Built with enterprise-grade security and performance in mind, it seamlessly integrates with your existing Bullhorn workflow.

### Key Features

- 🤖 **AI-Powered Conversations** - Natural language processing for intuitive Bullhorn data access
- 🔐 **Secure Bullhorn Authentication** - OAuth2 integration with your Bullhorn credentials
- 📊 **Live Data Access** - Real-time connection to your Bullhorn ATS via MCP (Model Context Protocol)
- 💬 **Conversation History** - Persistent chat history with intelligent title generation
- 🎨 **Modern UI** - Clean, responsive interface with light/dark mode support
- ⚡ **Fast & Reliable** - Streaming responses with optimized performance

## Prerequisites

- Node.js 18.x or later
- pnpm package manager
- Bullhorn ATS account with API access
- OpenAI API key for AI capabilities

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/bullhorn-chat.git
cd bullhorn-chat
```

2. Install dependencies:
```bash
pnpm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

## Configuration

### Required Environment Variables

```env
# OpenAI Configuration
NUXT_OPENAI_API_KEY=your-openai-api-key

# Bullhorn OAuth Configuration
NUXT_OAUTH_BULLHORN_CLIENT_ID=your-bullhorn-client-id
NUXT_OAUTH_BULLHORN_CLIENT_SECRET=your-bullhorn-client-secret

# Bullhorn MCP Server
NUXT_BULLHORN_MCP_URL=https://mcp.bullhornlabs.app

# Session Configuration
NUXT_SESSION_PASSWORD=your-secure-session-password
```

### Bullhorn OAuth Setup

1. Contact your Bullhorn representative to obtain OAuth credentials
2. Configure the redirect URI: `https://your-domain.com/auth/bullhorn`
3. Add the credentials to your `.env` file

## Development

Start the development server:

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`

### Development Features

- Hot module replacement
- Type checking
- ESLint integration
- Automatic code formatting

## Usage

1. **Login**: Click "Sign in" and authenticate with your Bullhorn credentials
2. **Start Chatting**: Type your questions in natural language
3. **Access Data**: Query candidates, jobs, clients, and more
4. **View History**: Access previous conversations from the sidebar

### Example Queries

- "Show me all software engineers in Boston"
- "Find active job orders from last week"
- "What's the status of candidate John Smith?"
- "List all clients in the technology sector"

## Architecture

### Technology Stack

- **Frontend**: Vue 3 + Nuxt 3 for a modern, performant UI
- **UI Components**: Nuxt UI Pro for consistent, accessible components
- **AI Integration**: OpenAI GPT-4 with Vercel AI SDK
- **Authentication**: OAuth2 with secure session management
- **Database**: SQLite (development) / Cloudflare D1 (production)
- **Hosting**: Optimized for Cloudflare Workers

### Security

- All API calls are authenticated and encrypted
- Session tokens are securely stored and rotated
- No Bullhorn credentials are stored locally
- Rate limiting and request validation

## Production Deployment

Build for production:

```bash
pnpm build
```

Deploy to Cloudflare:

```bash
npx nuxthub deploy
```

### Production Considerations

- Set up proper SSL certificates
- Configure rate limiting
- Enable monitoring and logging
- Set up backup procedures
- Review security policies

## Support

For issues related to:
- **Bullhorn Integration**: Contact your Bullhorn administrator
- **Technical Issues**: Create an issue in this repository
- **Feature Requests**: Submit through the project board

## License

This project is proprietary software. All rights reserved.
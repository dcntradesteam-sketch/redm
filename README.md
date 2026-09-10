# Astra Agent Runtime

Astra is a general-purpose personal AI agent runtime built around the OpenAI Agents SDK and Supabase.

## Current architecture

- TypeScript + Node.js HTTP service
- OpenAI Agents SDK agent runtime
- Supabase Postgres for projects, conversations, artifacts, memories, and run auditing
- Tool layer for project management and durable memory
- Environment-based secrets; never commit API keys

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Required environment variables:

- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `OPENAI_MODEL` (defaults to `gpt-6-astra` in the API response metadata)

## API

`GET /health`

`POST /api/agent/run`

```json
{
  "message": "Create a project called My App",
  "userId": "<authenticated-user-id>",
  "conversationId": "<optional-conversation-id>",
  "projectId": "<optional-project-id>"
}
```

The service records each agent run in `tool_runs` and updates the record to succeeded or failed.

## Security boundary

The runtime intentionally starts with narrowly scoped tools. Shell, filesystem, deployment, GitHub write access, email, calendar, and other high-impact capabilities should be added as separate tools with explicit authorization and audit behavior rather than giving the model unrestricted credentials.

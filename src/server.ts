import 'dotenv/config';
import express from 'express';
import { run } from '@openai/agents';
import { astra } from './agent.js';
import { supabaseForUser } from './tools.js';

const app = express(); app.use(express.json({ limit: '2mb' }));
const port = Number(process.env.PORT ?? 8787);
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required');
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) throw new Error('Supabase environment is required');

app.get('/health', (_req, res) => res.json({ ok: true, service: 'cyrex-1', version: '0.4.0' }));

app.post('/api/agent/run', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    const accessToken = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!accessToken) return res.status(401).json({ error: 'missing_bearer_token' });
    const userClient = supabaseForUser(accessToken);
    const { data: { user }, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !user) return res.status(401).json({ error: 'invalid_session' });
    const { message, conversationId, projectId } = req.body as { message?: string; conversationId?: string; projectId?: string };
    if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

    const { data: runRecord, error: insertError } = await userClient.from('tool_runs').insert({ user_id: user.id, conversation_id: conversationId ?? null, tool_name: 'cyrex_1', status: 'running', input: { message, projectId: projectId ?? null }, started_at: new Date().toISOString() }).select('id').single();
    if (insertError) throw new Error(insertError.message);
    try {
      const result = await run(astra, message, { context: { userId: user.id, accessToken, conversationId, projectId } });
      await userClient.from('tool_runs').update({ status: 'succeeded', output: { output: result.finalOutput }, finished_at: new Date().toISOString() }).eq('id', runRecord.id);
      return res.json({ output: result.finalOutput, runId: runRecord.id, userId: user.id });
    } catch (error) {
      await userClient.from('tool_runs').update({ status: 'failed', error: error instanceof Error ? error.message : String(error), finished_at: new Date().toISOString() }).eq('id', runRecord.id); throw error;
    }
  } catch (error) { console.error(error); return res.status(500).json({ error: 'agent_run_failed' }); }
});
app.listen(port, () => console.log(`Cyrex 1 listening on http://localhost:${port}`));

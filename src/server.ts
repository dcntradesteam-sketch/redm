import 'dotenv/config';
import express from 'express';
import { run } from '@openai/agents';
import { astra } from './agent.js';
import { supabase } from './tools.js';

const app = express();
app.use(express.json({ limit: '2mb' }));
const port = Number(process.env.PORT ?? 8787);

if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required');

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'astra-agent', version: '0.2.0' });
});

app.post('/api/agent/run', async (req, res) => {
  try {
    const { message, userId, conversationId, projectId } = req.body as { message?: string; userId?: string; conversationId?: string; projectId?: string };
    if (!message?.trim()) return res.status(400).json({ error: 'message is required' });
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const { data: runRecord, error: insertError } = await supabase.from('tool_runs').insert({
      user_id: userId,
      conversation_id: conversationId ?? null,
      tool_name: 'astra_agent',
      status: 'running',
      input: { message, projectId: projectId ?? null },
      started_at: new Date().toISOString(),
    }).select('id').single();
    if (insertError) throw new Error(insertError.message);

    try {
      const result = await run(astra, message, { context: { userId, conversationId, projectId } });
      await supabase.from('tool_runs').update({ status: 'succeeded', output: { output: result.finalOutput }, finished_at: new Date().toISOString() }).eq('id', runRecord.id);
      res.json({ output: result.finalOutput, runId: runRecord.id, model: process.env.OPENAI_MODEL ?? 'gpt-6-astra' });
    } catch (error) {
      await supabase.from('tool_runs').update({ status: 'failed', error: error instanceof Error ? error.message : String(error), finished_at: new Date().toISOString() }).eq('id', runRecord.id);
      throw error;
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'agent_run_failed' });
  }
});

app.listen(port, () => console.log(`Astra agent listening on http://localhost:${port}`));

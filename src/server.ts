import 'dotenv/config';
import express from 'express';
import { Agent, run } from '@openai/agents';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(express.json({ limit: '2mb' }));

const port = Number(process.env.PORT ?? 8787);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required');
if (!supabaseUrl || !supabaseKey) throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required');

const supabase = createClient(supabaseUrl, supabaseKey);

const astra = new Agent({
  name: 'Astra',
  instructions: `You are Astra, a general-purpose personal AI agent.\n\nYour job is to understand the user's goal, make a practical plan, use available tools when needed, verify results, and report what you actually accomplished. Never claim an action was completed unless it was successfully executed. Prefer safe, reversible operations and ask for confirmation before destructive external actions.`,
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'astra-agent' });
});

app.post('/api/agent/run', async (req, res) => {
  try {
    const { message } = req.body as { message?: string };
    if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

    const result = await run(astra, message);
    res.json({
      output: result.finalOutput,
      model: process.env.OPENAI_MODEL ?? 'gpt-6-astra',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'agent_run_failed' });
  }
});

app.listen(port, () => {
  console.log(`Astra agent listening on http://localhost:${port}`);
});

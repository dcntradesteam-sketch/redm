import type { VercelRequest, VercelResponse } from '@vercel/node';
import { run } from '@openai/agents';
import { astra } from '../../src/agent.js';
import { supabase } from '../../src/tools.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const { message, userId, conversationId, projectId } = (req.body ?? {}) as {
      message?: string; userId?: string; conversationId?: string; projectId?: string;
    };
    if (!message?.trim()) return res.status(400).json({ error: 'message is required' });
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const { data: runRecord, error: insertError } = await supabase.from('tool_runs').insert({
      user_id: userId, conversation_id: conversationId ?? null, tool_name: 'astra_agent',
      status: 'running', input: { message, projectId: projectId ?? null }, started_at: new Date().toISOString(),
    }).select('id').single();
    if (insertError) throw new Error(insertError.message);

    try {
      const result = await run(astra, message, { context: { userId, conversationId, projectId } });
      await supabase.from('tool_runs').update({ status: 'succeeded', output: { output: result.finalOutput }, finished_at: new Date().toISOString() }).eq('id', runRecord.id);
      return res.status(200).json({ output: result.finalOutput, runId: runRecord.id });
    } catch (error) {
      await supabase.from('tool_runs').update({ status: 'failed', error: error instanceof Error ? error.message : String(error), finished_at: new Date().toISOString() }).eq('id', runRecord.id);
      throw error;
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'agent_run_failed' });
  }
}

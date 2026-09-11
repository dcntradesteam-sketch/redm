import type { VercelRequest, VercelResponse } from '@vercel/node';
import { run } from '@openai/agents';
import { astra } from '../../src/agent';
import { supabaseForUser } from '../../src/tools';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const auth = req.headers.authorization;
    const accessToken = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!accessToken) return res.status(401).json({ error: 'missing_bearer_token' });
    const userClient = supabaseForUser(accessToken);
    const { data: { user }, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !user) return res.status(401).json({ error: 'invalid_session' });
    const { message, conversationId, projectId } = (req.body ?? {}) as { message?: string; conversationId?: string; projectId?: string };
    if (!message?.trim()) return res.status(400).json({ error: 'message is required' });
    const { data: runRecord, error: insertError } = await userClient.from('tool_runs').insert({ user_id: user.id, conversation_id: conversationId ?? null, tool_name: 'cyrex_1', status: 'running', input: { message, projectId: projectId ?? null }, started_at: new Date().toISOString() }).select('id').single();
    if (insertError) throw new Error(insertError.message);
    try {
      const result = await run(astra, message, { context: { userId: user.id, accessToken, conversationId, projectId } });
      await userClient.from('tool_runs').update({ status: 'succeeded', output: { output: result.finalOutput }, finished_at: new Date().toISOString() }).eq('id', runRecord.id);
      return res.status(200).json({ output: result.finalOutput, runId: runRecord.id });
    } catch (error) {
      await userClient.from('tool_runs').update({ status: 'failed', error: error instanceof Error ? error.message : String(error), finished_at: new Date().toISOString() }).eq('id', runRecord.id); throw error;
    }
  } catch (error) { console.error(error); return res.status(500).json({ error: 'agent_run_failed' }); }
}

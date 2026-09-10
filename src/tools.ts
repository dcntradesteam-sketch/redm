import { RunContext, tool } from '@openai/agents';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required');

export const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

export type AstraContext = { userId: string; conversationId?: string; projectId?: string };
type AstraRunContext = RunContext<AstraContext>;

export const listProjects = tool({
  name: 'list_projects',
  description: 'List the current user’s Astra projects.',
  parameters: z.object({}),
  async execute(_args, ctx: AstraRunContext) {
    const { data, error } = await supabase.from('projects').select('id,name,description,created_at,updated_at').eq('user_id', ctx.context.userId).order('updated_at', { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return JSON.stringify(data ?? []);
  },
});

export const createProject = tool({
  name: 'create_project',
  description: 'Create a new Astra project for the current user.',
  parameters: z.object({ name: z.string().min(1).max(120), description: z.string().max(1000).optional() }),
  async execute(args, ctx: AstraRunContext) {
    const { data, error } = await supabase.from('projects').insert({ user_id: ctx.context.userId, name: args.name, description: args.description ?? null }).select('id,name,description,created_at').single();
    if (error) throw new Error(error.message);
    return JSON.stringify(data);
  },
});

export const saveMemory = tool({
  name: 'save_memory',
  description: 'Save a useful durable fact or preference for the current user. Do not store secrets.',
  parameters: z.object({ category: z.string().min(1).max(80), content: z.string().min(1).max(4000) }),
  async execute(args, ctx: AstraRunContext) {
    const { data, error } = await supabase.from('memories').insert({ user_id: ctx.context.userId, category: args.category, content: args.content }).select('id,category,content,created_at').single();
    if (error) throw new Error(error.message);
    return JSON.stringify(data);
  },
});

export const recallMemories = tool({
  name: 'recall_memories',
  description: 'Recall durable memories for the current user, optionally filtered by category.',
  parameters: z.object({ category: z.string().max(80).optional() }),
  async execute(args, ctx: AstraRunContext) {
    let query = supabase.from('memories').select('id,category,content,created_at,updated_at').eq('user_id', ctx.context.userId).order('updated_at', { ascending: false }).limit(50);
    if (args.category) query = query.eq('category', args.category);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return JSON.stringify(data ?? []);
  },
});

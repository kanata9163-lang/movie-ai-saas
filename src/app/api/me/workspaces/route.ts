import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getAuthUser } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return errorResponse('unauthorized', 'Not logged in', 401);

  const db = getSupabase();

  // Get only workspaces the user is a member of
  const { data: memberships, error: memError } = await db
    .from('workspace_members')
    .select('role, workspace_id, workspaces(*)')
    .eq('user_id', user.id);

  if (memError) return errorResponse('db_error', memError.message, 500);

  const items = (memberships || []).map((m: Record<string, unknown>) => ({
    ...(m.workspaces as Record<string, unknown>),
    role: m.role,
  }));

  return jsonResponse({ items });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return errorResponse('unauthorized', 'Not logged in', 401);

  const body = await request.json();
  const { name } = body;
  if (!name?.trim()) return errorResponse('validation', 'name is required');

  const db = getSupabase();
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 20) || 'workspace';

  // Ensure unique slug
  const { data: existing } = await db.from('workspaces').select('id').eq('slug', slug).single();
  const finalSlug = existing ? `${slug}-${Date.now().toString(36).slice(-4)}` : slug;

  const { data: ws, error: wsErr } = await db
    .from('workspaces')
    .insert({ name: name.trim(), slug: finalSlug })
    .select()
    .single();

  if (wsErr) return errorResponse('db_error', wsErr.message, 500);

  await db.from('workspace_members').insert({
    workspace_id: ws.id,
    user_id: user.id,
    role: 'owner',
  });

  return jsonResponse(ws, 201);
}

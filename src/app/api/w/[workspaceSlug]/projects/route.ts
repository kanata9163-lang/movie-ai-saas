import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const q = url.searchParams.get('q');

  let query = db
    .from('projects')
    .select('*')
    .eq('workspace_id', auth.workspace.id)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (q) query = query.ilike('name', `%${q}%`);

  const { data, error } = await query;
  if (error) return errorResponse('db_error', error.message, 500);

  return jsonResponse(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const body = await request.json();
  const { name, client_id, owner_user_id } = body;

  if (!name) return errorResponse('validation', 'name is required');

  const { data, error } = await db
    .from('projects')
    .insert({
      workspace_id: auth.workspace.id,
      name,
      status: '対応中',
      client_id: client_id || null,
      owner_user_id: owner_user_id || null,
    })
    .select()
    .single();

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data, 201);
}

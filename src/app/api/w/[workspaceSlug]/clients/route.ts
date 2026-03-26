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
  const q = url.searchParams.get('q');

  let query = db
    .from('clients')
    .select('*')
    .eq('workspace_id', auth.workspace.id)
    .order('created_at', { ascending: false });

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
  if (!body.name) return errorResponse('validation', 'name is required');

  const { data, error } = await db
    .from('clients')
    .insert({
      workspace_id: auth.workspace.id,
      name: body.name,
      notes: body.notes || null,
    })
    .select()
    .single();

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data, 201);
}

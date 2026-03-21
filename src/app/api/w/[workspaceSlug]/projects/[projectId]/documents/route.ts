import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceBySlug } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const db = getSupabase();
  const url = new URL(request.url);
  const type = url.searchParams.get('type');

  let query = db
    .from('documents')
    .select('*')
    .eq('project_id', params.projectId)
    .order('created_at', { ascending: false });

  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const db = getSupabase();
  const workspace = await getWorkspaceBySlug(params.workspaceSlug);
  if (!workspace) return errorResponse('not_found', 'Workspace not found', 404);
  const body = await request.json();
  if (!body.type) return errorResponse('validation', 'type is required');

  const { data, error } = await db
    .from('documents')
    .insert({
      project_id: params.projectId,
      workspace_id: workspace.id,
      type: body.type,
      title: body.title || null,
      url: body.url || null,
      memo: body.memo || null,
      asset_id: body.asset_id || null,
    })
    .select()
    .single();

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data, 201);
}

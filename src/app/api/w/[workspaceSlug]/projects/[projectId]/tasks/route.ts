import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const { data, error } = await db
    .from('tasks')
    .select('*')
    .eq('project_id', params.projectId)
    .order('order_index');

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const body = await request.json();
  if (!body.title) return errorResponse('validation', 'title is required');

  const { data, error } = await db
    .from('tasks')
    .insert({
      project_id: params.projectId,
      workspace_id: auth.workspace.id,
      title: body.title,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      assignee_user_id: body.assignee_user_id || null,
      assignee_name: body.assignee_name || null,
      order_index: body.order_index || 0,
    })
    .select()
    .single();

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data, 201);
}

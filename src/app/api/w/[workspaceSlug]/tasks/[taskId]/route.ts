import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; taskId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.is_completed !== undefined) updates.is_completed = body.is_completed;
  if (body.start_date !== undefined) updates.start_date = body.start_date;
  if (body.end_date !== undefined) updates.end_date = body.end_date;
  if (body.assignee_user_id !== undefined) updates.assignee_user_id = body.assignee_user_id;
  if (body.order_index !== undefined) updates.order_index = body.order_index;

  const { data, error } = await db
    .from('tasks')
    .update(updates)
    .eq('id', params.taskId)
    .select()
    .single();

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; taskId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const { error } = await db
    .from('tasks')
    .delete()
    .eq('id', params.taskId);

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(null);
}

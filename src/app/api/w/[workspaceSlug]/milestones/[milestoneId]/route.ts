import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; milestoneId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.status !== undefined) updates.status = body.status;
  if (body.start_date !== undefined) updates.start_date = body.start_date;
  if (body.end_date !== undefined) updates.end_date = body.end_date;
  if (body.due_date !== undefined) updates.due_date = body.due_date;
  if (body.order_index !== undefined) updates.order_index = body.order_index;

  const { data, error } = await db
    .from('milestones')
    .update(updates)
    .eq('id', params.milestoneId)
    .select()
    .single();

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; milestoneId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const { error } = await db.from('milestones').delete().eq('id', params.milestoneId);
  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(null);
}

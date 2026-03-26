import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; draftSceneId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.dialogue !== undefined) updates.dialogue = body.dialogue;
  if (body.description !== undefined) updates.description = body.description;
  if (body.image_prompt !== undefined) updates.image_prompt = body.image_prompt;

  const { data, error } = await db
    .from('draft_scenes')
    .update(updates)
    .eq('id', params.draftSceneId)
    .select()
    .single();

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; draftSceneId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const { error } = await db.from('draft_scenes').delete().eq('id', params.draftSceneId);
  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(null);
}

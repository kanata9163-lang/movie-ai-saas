import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse } from '@/lib/api-helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; documentId: string } }
) {
  const db = getSupabase();
  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.type !== undefined) updates.type = body.type;
  if (body.title !== undefined) updates.title = body.title;
  if (body.url !== undefined) updates.url = body.url;
  if (body.memo !== undefined) updates.memo = body.memo;
  if (body.asset_id !== undefined) updates.asset_id = body.asset_id;

  const { data, error } = await db
    .from('documents')
    .update(updates)
    .eq('id', params.documentId)
    .select()
    .single();

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; documentId: string } }
) {
  const db = getSupabase();
  const { error } = await db.from('documents').delete().eq('id', params.documentId);
  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(null);
}

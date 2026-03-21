import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse } from '@/lib/api-helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; clientId: string } }
) {
  const db = getSupabase();
  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.notes !== undefined) updates.notes = body.notes;

  const { data, error } = await db
    .from('clients')
    .update(updates)
    .eq('id', params.clientId)
    .select()
    .single();

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; clientId: string } }
) {
  const db = getSupabase();
  const { error } = await db
    .from('clients')
    .delete()
    .eq('id', params.clientId);

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(null);
}

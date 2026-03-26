import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; budgetItemId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.category !== undefined) updates.category = body.category;
  if (body.title !== undefined) updates.title = body.title;
  if (body.amount !== undefined) updates.amount = body.amount;
  if (body.quantity !== undefined) updates.quantity = body.quantity;
  if (body.vendor !== undefined) updates.vendor = body.vendor;
  if (body.incurred_on !== undefined) updates.incurred_on = body.incurred_on;

  const { data, error } = await db
    .from('budget_items')
    .update(updates)
    .eq('id', params.budgetItemId)
    .select()
    .single();

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; budgetItemId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const { error } = await db.from('budget_items').delete().eq('id', params.budgetItemId);
  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(null);
}

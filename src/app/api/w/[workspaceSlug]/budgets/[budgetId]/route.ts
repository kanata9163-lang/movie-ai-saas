import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse } from '@/lib/api-helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; budgetId: string } }
) {
  const db = getSupabase();
  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.currency !== undefined) updates.currency = body.currency;
  if (body.total_budget !== undefined) updates.total_budget = body.total_budget;
  if (body.notes !== undefined) updates.notes = body.notes;

  const { data, error } = await db
    .from('budgets')
    .update(updates)
    .eq('id', params.budgetId)
    .select()
    .single();

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data);
}

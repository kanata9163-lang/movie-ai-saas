import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; budgetId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const { data, error } = await db
    .from('budget_items')
    .select('*')
    .eq('budget_id', params.budgetId)
    .order('created_at');

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; budgetId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const body = await request.json();
  if (!body.category || !body.title || body.amount === undefined)
    return errorResponse('validation', 'category, title, amount are required');

  const { data, error } = await db
    .from('budget_items')
    .insert({
      budget_id: params.budgetId,
      category: body.category,
      title: body.title,
      amount: body.amount,
      quantity: body.quantity || 1,
      vendor: body.vendor || null,
      incurred_on: body.incurred_on || null,
    })
    .select()
    .single();

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data, 201);
}

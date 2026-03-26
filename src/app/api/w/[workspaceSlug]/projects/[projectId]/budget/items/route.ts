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
    .from('budget_items')
    .select('*, budget_categories(name)')
    .eq('project_id', params.projectId)
    .order('date', { ascending: false });

  if (error) return errorResponse('db_error', error.message, 500);

  const items = (data || []).map((item: Record<string, unknown>) => ({
    ...item,
    category_name: (item.budget_categories as { name: string } | null)?.name || null,
  }));

  return jsonResponse(items);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const body = await request.json();

  if (!body.description) return errorResponse('validation', 'Description is required');
  if (body.amount == null) return errorResponse('validation', 'Amount is required');

  const { data, error } = await db
    .from('budget_items')
    .insert({
      project_id: params.projectId,
      category_id: body.category_id || null,
      description: body.description,
      amount: body.amount,
      date: body.date || new Date().toISOString().split('T')[0],
      notes: body.notes || null,
    })
    .select('*, budget_categories(name)')
    .single();

  if (error) return errorResponse('db_error', error.message, 500);

  return jsonResponse({
    ...data,
    category_name: (data.budget_categories as { name: string } | null)?.name || null,
  }, 201);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return errorResponse('validation', 'Item id is required');

  const db = getSupabase();
  const { error } = await db
    .from('budget_items')
    .delete()
    .eq('id', id)
    .eq('project_id', params.projectId);

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(null);
}

import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();

  // Get project budget_limit
  const { data: project } = await db
    .from('projects')
    .select('id, name, budget_limit')
    .eq('id', params.projectId)
    .single();

  // Get categories
  const { data: categories } = await db
    .from('budget_categories')
    .select('*')
    .eq('project_id', params.projectId)
    .order('created_at', { ascending: true });

  // Get items with category join
  const { data: items } = await db
    .from('budget_items')
    .select('*, budget_categories(name)')
    .eq('project_id', params.projectId)
    .order('date', { ascending: false });

  // Calculate category totals
  const categoryTotals: Record<string, number> = {};
  for (const item of items || []) {
    const catId = item.category_id || 'uncategorized';
    categoryTotals[catId] = (categoryTotals[catId] || 0) + item.amount;
  }

  const totalSpent = (items || []).reduce((sum: number, item: { amount: number }) => sum + item.amount, 0);

  return jsonResponse({
    project: {
      id: project?.id,
      name: project?.name,
      budget_limit: project?.budget_limit || 0,
    },
    categories: (categories || []).map((cat: { id: string; name: string; budget_limit: number; created_at: string }) => ({
      ...cat,
      total_spent: categoryTotals[cat.id] || 0,
    })),
    items: (items || []).map((item: Record<string, unknown>) => ({
      ...item,
      category_name: (item.budget_categories as { name: string } | null)?.name || null,
    })),
    total_spent: totalSpent,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const body = await request.json();

  const { data, error } = await db
    .from('projects')
    .update({ budget_limit: body.budget_limit })
    .eq('id', params.projectId)
    .select('id, budget_limit')
    .single();

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

  const { data, error } = await db
    .from('budgets')
    .insert({
      project_id: params.projectId,
      workspace_id: auth.workspace.id,
      currency: body.currency || 'JPY',
      total_budget: body.total_budget || 0,
      notes: body.notes || null,
    })
    .select()
    .single();

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data, 201);
}

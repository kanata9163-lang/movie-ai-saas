import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceBySlug } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const db = getSupabase();
  const { data, error } = await db
    .from('budgets')
    .select('*')
    .eq('project_id', params.projectId)
    .single();

  if (error) return jsonResponse(null);
  return jsonResponse(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const db = getSupabase();
  const workspace = await getWorkspaceBySlug(params.workspaceSlug);
  if (!workspace) return errorResponse('not_found', 'Workspace not found', 404);
  const body = await request.json();

  const { data, error } = await db
    .from('budgets')
    .insert({
      project_id: params.projectId,
      workspace_id: workspace.id,
      currency: body.currency || 'JPY',
      total_budget: body.total_budget || 0,
      notes: body.notes || null,
    })
    .select()
    .single();

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data, 201);
}

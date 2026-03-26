import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const body = await request.json();

  if (!body.name) return errorResponse('validation', 'Category name is required');

  const { data, error } = await db
    .from('budget_categories')
    .insert({
      project_id: params.projectId,
      name: body.name,
      budget_limit: body.budget_limit || 0,
    })
    .select()
    .single();

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data, 201);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return errorResponse('validation', 'Category id is required');

  const db = getSupabase();
  const { error } = await db
    .from('budget_categories')
    .delete()
    .eq('id', id)
    .eq('project_id', params.projectId);

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(null);
}

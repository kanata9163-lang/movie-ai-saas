import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const { data: project, error } = await db
    .from('projects')
    .select('*')
    .eq('id', params.projectId)
    .eq('workspace_id', auth.workspace.id)
    .single();

  if (error || !project) return errorResponse('not_found', 'Project not found', 404);

  // Get summary
  const { count: storyboardCount } = await db
    .from('storyboards')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', project.id);

  const { count: draftCount } = await db
    .from('drafts')
    .select('id, storyboard_id', { count: 'exact', head: true });

  const { data: budget } = await db
    .from('budgets')
    .select('id, total_budget, currency')
    .eq('project_id', project.id)
    .single();

  const { data: nextMilestone } = await db
    .from('milestones')
    .select('id, name, due_date')
    .eq('project_id', project.id)
    .eq('status', 'planned')
    .order('order_index')
    .limit(1)
    .single();

  return jsonResponse({
    project,
    summary: {
      storyboard_count: storyboardCount || 0,
      draft_count: draftCount || 0,
      next_milestone: nextMilestone || null,
      budget: budget || null,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.status !== undefined) updates.status = body.status;
  if (body.overview !== undefined) updates.overview = body.overview;
  if (body.client_id !== undefined) updates.client_id = body.client_id;
  if (body.owner_user_id !== undefined) updates.owner_user_id = body.owner_user_id;

  const { data, error } = await db
    .from('projects')
    .update(updates)
    .eq('id', params.projectId)
    .eq('workspace_id', auth.workspace.id)
    .select()
    .single();

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const { error } = await db
    .from('projects')
    .delete()
    .eq('id', params.projectId)
    .eq('workspace_id', auth.workspace.id);

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(null);
}

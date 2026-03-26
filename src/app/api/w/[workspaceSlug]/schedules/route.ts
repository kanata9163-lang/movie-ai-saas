import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();

  // Get all projects in workspace
  const { data: projects } = await db
    .from('projects')
    .select('id, name')
    .eq('workspace_id', auth.workspace.id);

  if (!projects || projects.length === 0) {
    return jsonResponse([]);
  }

  const projectIds = projects.map(p => p.id);

  // Get all milestones for all projects in workspace
  const { data: milestones, error } = await db
    .from('milestones')
    .select('*')
    .in('project_id', projectIds)
    .order('start_date', { ascending: true });

  if (error) return errorResponse('db_error', error.message, 500);

  // Attach project name to each milestone
  const projectMap = new Map(projects.map(p => [p.id, p.name]));
  const result = (milestones || []).map(m => ({
    ...m,
    project_name: projectMap.get(m.project_id) || '',
  }));

  return jsonResponse(result);
}

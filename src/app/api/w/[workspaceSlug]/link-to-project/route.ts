import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

const VALID_TYPES = ['ad_analysis', 'trend_report', 'knowledge_item', 'video_project', 'asset'] as const;

const TABLE_MAP: Record<string, string> = {
  ad_analysis: 'ad_analyses',
  trend_report: 'trend_reports',
  knowledge_item: 'knowledge_items',
  video_project: 'video_projects',
  asset: 'assets',
};

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const body = await request.json();
  const { resourceType, resourceId, projectId } = body;

  if (!resourceType || !resourceId || !projectId) {
    return errorResponse('validation', 'resourceType, resourceId, and projectId are required');
  }

  if (!VALID_TYPES.includes(resourceType)) {
    return errorResponse('validation', `Invalid resourceType: ${resourceType}`);
  }

  const db = getSupabase();

  // Verify project belongs to workspace
  const { data: project, error: projErr } = await db
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('workspace_id', auth.workspace.id)
    .single();

  if (projErr || !project) {
    return errorResponse('not_found', 'Project not found', 404);
  }

  // Update the resource
  const table = TABLE_MAP[resourceType];
  const { error } = await db
    .from(table)
    .update({ project_id: projectId })
    .eq('id', resourceId);

  if (error) return errorResponse('db_error', error.message, 500);

  return jsonResponse({ linked: true });
}

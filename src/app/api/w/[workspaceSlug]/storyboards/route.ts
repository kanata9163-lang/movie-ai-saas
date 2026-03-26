import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceBySlug } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string } }
) {
  const db = getSupabase();
  const workspace = await getWorkspaceBySlug(params.workspaceSlug);
  if (!workspace) return errorResponse('not_found', 'Workspace not found', 404);

  // Get all storyboards for this workspace with project name
  const { data, error } = await db
    .from('storyboards')
    .select('*, projects(name)')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false });

  if (error) return errorResponse('db_error', error.message, 500);

  const result = (data || []).map((sb: Record<string, unknown>) => ({
    ...sb,
    project_name: (sb.projects as { name: string } | null)?.name || null,
    projects: undefined,
  }));

  return jsonResponse(result);
}

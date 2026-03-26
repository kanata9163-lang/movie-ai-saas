import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceBySlug } from '@/lib/api-helpers';

// GET: List all elements for a project
export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const db = getSupabase();
  const { data, error } = await db
    .from('project_elements')
    .select('id, project_id, name, label, mime_type, image_data, created_at')
    .eq('project_id', params.projectId)
    .order('created_at', { ascending: true });

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data);
}

// POST: Create a new element (upload reference image)
export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const workspace = await getWorkspaceBySlug(params.workspaceSlug);
  if (!workspace) return errorResponse('not_found', 'Workspace not found', 404);

  const body = await request.json();
  if (!body.image_data) return errorResponse('validation', 'image_data is required');

  // Check max 4 elements per project
  const db = getSupabase();
  const { count } = await db
    .from('project_elements')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', params.projectId);

  if (count !== null && count >= 4) {
    return errorResponse('limit', 'Maximum 4 elements per project', 400);
  }

  const { data, error } = await db
    .from('project_elements')
    .insert({
      project_id: params.projectId,
      workspace_id: workspace.id,
      name: body.name || '',
      label: body.label || '',
      mime_type: body.mime_type || 'image/png',
      image_data: body.image_data,
    })
    .select()
    .single();

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data, 201);
}

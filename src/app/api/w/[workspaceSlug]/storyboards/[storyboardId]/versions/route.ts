import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; storyboardId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const { data, error } = await db
    .from('storyboard_versions')
    .select('*')
    .eq('storyboard_id', params.storyboardId)
    .order('version_number', { ascending: false });

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data);
}

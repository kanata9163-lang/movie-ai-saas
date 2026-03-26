import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

// DELETE: Remove an element
export async function DELETE(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; elementId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const { error } = await db
    .from('project_elements')
    .delete()
    .eq('id', params.elementId);

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(null);
}

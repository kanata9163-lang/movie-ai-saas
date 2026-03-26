import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();

  const { data: members, error } = await db
    .from('workspace_members')
    .select('id, user_id, role, created_at')
    .eq('workspace_id', auth.workspace.id)
    .order('created_at');

  if (error) return errorResponse('db_error', error.message, 500);

  // Fetch user emails for each member
  const membersWithEmail = [];
  for (const member of members || []) {
    const { data: userData } = await db.auth.admin.getUserById(member.user_id);
    membersWithEmail.push({
      ...member,
      email: userData?.user?.email || 'unknown',
      display_name: userData?.user?.user_metadata?.full_name || userData?.user?.email || 'unknown',
    });
  }

  return jsonResponse(membersWithEmail);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  if (auth.role !== 'owner' && auth.role !== 'admin') {
    return errorResponse('forbidden', 'Only owners and admins can remove members', 403);
  }

  const url = new URL(request.url);
  const memberId = url.searchParams.get('memberId');
  if (!memberId) return errorResponse('validation', 'memberId is required');

  const db = getSupabase();

  // Prevent removing the last owner
  const { data: member } = await db
    .from('workspace_members')
    .select('role, user_id')
    .eq('id', memberId)
    .eq('workspace_id', auth.workspace.id)
    .single();

  if (!member) return errorResponse('not_found', 'Member not found', 404);

  if (member.role === 'owner') {
    const { count } = await db
      .from('workspace_members')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', auth.workspace.id)
      .eq('role', 'owner');

    if ((count || 0) <= 1) {
      return errorResponse('forbidden', 'Cannot remove the last owner', 403);
    }
  }

  const { error } = await db
    .from('workspace_members')
    .delete()
    .eq('id', memberId)
    .eq('workspace_id', auth.workspace.id);

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(null);
}

import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getAuthUser } from '@/lib/api-helpers';

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return errorResponse('unauthorized', 'Not logged in', 401);

  const { token } = await request.json();
  if (!token) return errorResponse('validation', 'token is required');

  const db = getSupabase();

  // Find the invite token
  const { data: invite, error: inviteError } = await db
    .from('invite_tokens')
    .select('*, workspaces(id, slug, name)')
    .eq('token', token)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (inviteError || !invite) {
    return errorResponse('invalid_token', 'Invite link is invalid or expired', 400);
  }

  // Check if user is already a member
  const { data: existingMembership } = await db
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', invite.workspace_id)
    .eq('user_id', user.id)
    .single();

  if (existingMembership) {
    const ws = invite.workspaces as { slug: string };
    return jsonResponse({ workspaceSlug: ws.slug, alreadyMember: true });
  }

  // Add user as member
  const { error: memberError } = await db
    .from('workspace_members')
    .insert({
      workspace_id: invite.workspace_id,
      user_id: user.id,
      role: 'member',
    });

  if (memberError) return errorResponse('db_error', memberError.message, 500);

  // Mark invite as used
  await db
    .from('invite_tokens')
    .update({
      used_at: new Date().toISOString(),
      used_by: user.id,
    })
    .eq('id', invite.id);

  const ws = invite.workspaces as { slug: string };
  return jsonResponse({ workspaceSlug: ws.slug, alreadyMember: false });
}

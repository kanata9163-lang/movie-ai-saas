import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

// POST: Create an invite token
export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  if (auth.role !== 'owner' && auth.role !== 'admin') {
    return errorResponse('forbidden', 'Only owners and admins can create invites', 403);
  }

  const db = getSupabase();
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  const { data, error } = await db
    .from('invite_tokens')
    .insert({
      workspace_id: auth.workspace.id,
      token,
      invited_by: auth.userId,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data, 201);
}

// GET: List active invites
export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const { data, error } = await db
    .from('invite_tokens')
    .select('*')
    .eq('workspace_id', auth.workspace.id)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data);
}

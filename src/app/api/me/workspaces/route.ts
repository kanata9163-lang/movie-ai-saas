import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getAuthUser } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return errorResponse('unauthorized', 'Not logged in', 401);

  const db = getSupabase();

  // Get only workspaces the user is a member of
  const { data: memberships, error: memError } = await db
    .from('workspace_members')
    .select('role, workspace_id, workspaces(*)')
    .eq('user_id', user.id);

  if (memError) return errorResponse('db_error', memError.message, 500);

  const items = (memberships || []).map((m: Record<string, unknown>) => ({
    ...(m.workspaces as Record<string, unknown>),
    role: m.role,
  }));

  return jsonResponse({ items });
}

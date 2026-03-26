import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const { data, error } = await db
    .from('integrations')
    .select('id, type, config, enabled, created_at, updated_at')
    .eq('workspace_id', auth.workspace.id)
    .order('type');

  if (error) return errorResponse('db_error', error.message, 500);

  // Mask sensitive fields
  const masked = (data || []).map((item: Record<string, unknown>) => ({
    ...item,
    config: maskConfig(item.config as Record<string, unknown>),
  }));

  return jsonResponse(masked);
}

function maskConfig(config: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string' && value.length > 8) {
      masked[key] = value.slice(0, 4) + '****' + value.slice(-4);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  if (auth.role !== 'owner' && auth.role !== 'admin') {
    return errorResponse('forbidden', 'Admin access required', 403);
  }

  const body = await request.json();
  const { type, config, enabled } = body;

  if (!type || !['slack', 'line'].includes(type)) {
    return errorResponse('invalid_type', 'Type must be slack or line', 400);
  }

  const db = getSupabase();

  const { data, error } = await db
    .from('integrations')
    .upsert(
      {
        workspace_id: auth.workspace.id,
        type,
        config: config || {},
        enabled: enabled !== undefined ? enabled : true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,type' }
    )
    .select()
    .single();

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  if (auth.role !== 'owner' && auth.role !== 'admin') {
    return errorResponse('forbidden', 'Admin access required', 403);
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  if (!type) return errorResponse('missing_type', 'Type query param required', 400);

  const db = getSupabase();
  const { error } = await db
    .from('integrations')
    .delete()
    .eq('workspace_id', auth.workspace.id)
    .eq('type', type);

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(null);
}

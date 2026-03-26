import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; assetId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();

  const { data: asset } = await db
    .from('assets')
    .select('storage_path')
    .eq('id', params.assetId)
    .eq('workspace_id', auth.workspace.id)
    .single();

  if (!asset) return errorResponse('not_found', 'Asset not found', 404);

  // Delete from storage
  await db.storage.from('assets').remove([asset.storage_path]);

  // Delete from DB
  const { error } = await db
    .from('assets')
    .delete()
    .eq('id', params.assetId);

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(null);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; assetId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const { data: asset } = await db
    .from('assets')
    .select('*')
    .eq('id', params.assetId)
    .eq('workspace_id', auth.workspace.id)
    .single();

  if (!asset) return errorResponse('not_found', 'Asset not found', 404);

  // Download from storage
  const { data, error } = await db.storage.from('assets').download(asset.storage_path);
  if (error || !data) return errorResponse('storage_error', 'Download failed', 500);

  const buffer = await data.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': asset.mime_type,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(asset.file_name)}"`,
    },
  });
}

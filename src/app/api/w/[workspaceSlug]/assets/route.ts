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
    .from('assets')
    .select('*')
    .eq('workspace_id', auth.workspace.id)
    .order('created_at', { ascending: false });

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return errorResponse('validation', 'file is required');

  const db = getSupabase();
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const path = `${auth.workspace.id}/${Date.now()}_${file.name}`;

  const { error: uploadError } = await db.storage
    .from('assets')
    .upload(path, buffer, { contentType: file.type });

  if (uploadError) {
    // Try creating the bucket if it doesn't exist
    await db.storage.createBucket('assets', { public: false });
    const { error: retryError } = await db.storage
      .from('assets')
      .upload(path, buffer, { contentType: file.type });
    if (retryError) return errorResponse('storage_error', retryError.message, 500);
  }

  const { data, error } = await db
    .from('assets')
    .insert({
      workspace_id: auth.workspace.id,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      storage_path: path,
      type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document',
    })
    .select()
    .single();

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data, 201);
}

import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const url = new URL(request.url);
  const section = url.searchParams.get('section');

  let query = db
    .from('project_documents')
    .select('*')
    .eq('project_id', params.projectId)
    .order('created_at', { ascending: false });

  if (section) {
    query = query.eq('section', section);
  }

  const { data, error } = await query;
  if (error) return errorResponse('db_error', error.message, 500);

  return jsonResponse(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    // File upload
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const section = (formData.get('section') as string) || 'materials';

    if (!file) return errorResponse('validation', 'file is required');

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `projects/${params.projectId}/docs/${timestamp}_${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await db.storage
      .from('assets')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) return errorResponse('upload_error', uploadError.message, 500);

    const { data, error } = await db
      .from('project_documents')
      .insert({
        project_id: params.projectId,
        section,
        title: file.name,
        file_name: file.name,
        file_path: storagePath,
        mime_type: file.type,
        size_bytes: file.size,
      })
      .select()
      .single();

    if (error) return errorResponse('db_error', error.message, 500);
    return jsonResponse(data, 201);
  } else {
    // JSON text entry
    const body = await request.json();
    const { section, title, url, memo } = body;

    if (!title) return errorResponse('validation', 'title is required');

    const { data, error } = await db
      .from('project_documents')
      .insert({
        project_id: params.projectId,
        section: section || 'materials',
        title,
        url: url || null,
        memo: memo || null,
      })
      .select()
      .single();

    if (error) return errorResponse('db_error', error.message, 500);
    return jsonResponse(data, 201);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const url = new URL(request.url);
  const docId = url.searchParams.get('id');

  if (!docId) return errorResponse('validation', 'id is required');

  // Get the document first to check for file_path
  const { data: doc, error: fetchError } = await db
    .from('project_documents')
    .select('*')
    .eq('id', docId)
    .eq('project_id', params.projectId)
    .single();

  if (fetchError || !doc) return errorResponse('not_found', 'Document not found', 404);

  // Delete from storage if file exists
  if (doc.file_path) {
    await db.storage.from('assets').remove([doc.file_path]);
  }

  const { error } = await db
    .from('project_documents')
    .delete()
    .eq('id', docId)
    .eq('project_id', params.projectId);

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(null);
}

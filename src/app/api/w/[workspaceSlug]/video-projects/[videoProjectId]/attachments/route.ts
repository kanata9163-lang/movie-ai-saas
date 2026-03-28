import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getWorkspaceWithAuth, errorResponse } from '@/lib/api-helpers';
import { isSupportedFileType, getFileTypeLabel, extractTextFromFile } from '@/lib/file-parser';

export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: { workspaceSlug: string; videoProjectId: string } }) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const supabase = createServerClient();
  const { data } = await supabase
    .from('video_attachments')
    .select('id, file_name, mime_type, file_type_label, extracted_text, created_at')
    .eq('video_project_id', params.videoProjectId)
    .order('created_at');

  return NextResponse.json({ ok: true, data: data || [] });
}

export async function POST(req: NextRequest, { params }: { params: { workspaceSlug: string; videoProjectId: string } }) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const { file_data, file_name, mime_type } = await req.json();

  if (!file_data || !file_name) {
    return errorResponse('validation', 'ファイルデータが必要です', 400);
  }

  if (!isSupportedFileType(mime_type)) {
    return errorResponse('validation', '対応していないファイル形式です。PDF, Word, CSV, Excelに対応しています。', 400);
  }

  // Extract base64 from data URL if needed
  let base64 = file_data;
  if (base64.startsWith('data:')) {
    base64 = base64.split(',')[1];
  }

  try {
    // Extract text content from the file
    const extractedText = await extractTextFromFile(base64, mime_type, file_name);

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('video_attachments')
      .insert({
        video_project_id: params.videoProjectId,
        file_name,
        mime_type,
        file_type_label: getFileTypeLabel(mime_type),
        extracted_text: extractedText.slice(0, 10000), // Limit to 10k chars
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: `ファイル読み取りに失敗しました: ${message}` }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { workspaceSlug: string; videoProjectId: string } }) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const { searchParams } = new URL(req.url);
  const attachmentId = searchParams.get('id');
  if (!attachmentId) return errorResponse('validation', 'id is required', 400);

  const supabase = createServerClient();
  await supabase.from('video_attachments').delete().eq('id', attachmentId);

  return NextResponse.json({ ok: true });
}

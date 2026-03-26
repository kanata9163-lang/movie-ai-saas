import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getWorkspaceWithAuth, errorResponse } from '@/lib/api-helpers';
import { sendSlackNotification } from '@/lib/integrations/slack';
import { sendLineNotification } from '@/lib/integrations/line';

export async function GET(req: NextRequest, { params }: { params: { workspaceSlug: string; videoProjectId: string } }) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const supabase = createServerClient();

  const { data: project, error } = await supabase
    .from('video_projects')
    .select('*')
    .eq('id', params.videoProjectId)
    .eq('workspace_id', auth.workspace.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const { data: scenes } = await supabase
    .from('video_scenes')
    .select('*')
    .eq('video_project_id', params.videoProjectId)
    .order('scene_number');

  const { data: refImages } = await supabase
    .from('video_reference_images')
    .select('id, image_type, name, created_at')
    .eq('video_project_id', params.videoProjectId);

  return NextResponse.json({ ok: true, data: { ...project, scenes: scenes || [], reference_images: refImages || [] } });
}

export async function PATCH(req: NextRequest, { params }: { params: { workspaceSlug: string; videoProjectId: string } }) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const supabase = createServerClient();
  const body = await req.json();

  const { data, error } = await supabase
    .from('video_projects')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.videoProjectId)
    .eq('workspace_id', auth.workspace.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send notifications when video project completes
  if (body.status === '完了' || body.status === 'completed') {
    const wsId = auth.workspace.id as string;
    const title = data?.title || '無題';
    const notifText = `\ud83c\udfac \u52d5\u753b\u300c${title}\u300d\u304c\u5b8c\u6210\u3057\u307e\u3057\u305f\uff01`;
    await Promise.all([
      sendSlackNotification(wsId, { text: notifText }),
      sendLineNotification(wsId, notifText),
    ]);
  }

  return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: NextRequest, { params }: { params: { workspaceSlug: string; videoProjectId: string } }) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const supabase = createServerClient();
  const { error } = await supabase.from('video_projects').delete().eq('id', params.videoProjectId).eq('workspace_id', auth.workspace.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

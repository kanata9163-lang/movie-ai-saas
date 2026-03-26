import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getWorkspaceWithAuth, errorResponse } from '@/lib/api-helpers';
import { createVideoFromImage } from '@/lib/video/api/runway';

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: { workspaceSlug: string; videoProjectId: string } }) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const body = await req.json();
  const { sceneId } = body;
  if (!sceneId) return errorResponse('bad_request', 'sceneId required', 400);

  const supabase = createServerClient();

  // Get scene
  const { data: scene } = await supabase
    .from('video_scenes')
    .select('*')
    .eq('id', sceneId)
    .eq('video_project_id', params.videoProjectId)
    .single();

  if (!scene) return errorResponse('not_found', 'Scene not found', 404);
  if (!scene.image_url) return errorResponse('bad_request', 'Scene has no image', 400);

  // Get project aspect ratio
  const { data: project } = await supabase
    .from('video_projects')
    .select('aspect_ratio, pipeline_logs')
    .eq('id', params.videoProjectId)
    .single();

  const aspectRatio = project?.aspect_ratio || '9:16';

  try {
    // Build prompt same as orchestrator
    let videoPrompt = (scene.description || scene.image_prompt || '').replace(/^CONSISTENT STYLE:.*?SCENE:\s*/i, '');
    videoPrompt = `Smooth cinematic motion, professional quality. ${videoPrompt}`.slice(0, 500);

    const taskId = await createVideoFromImage(scene.image_url, videoPrompt, scene.duration || 5, aspectRatio);

    // Update scene status
    await supabase.from('video_scenes').update({
      video_task_id: taskId,
      status: 'video_generating',
      video_url: null,
    }).eq('id', sceneId);

    // Add log
    const logs = project?.pipeline_logs || [];
    logs.push(`[${new Date().toLocaleTimeString('ja-JP')}] 🔄 シーン${scene.scene_number} 動画再生成タスク送信（ID: ${taskId.slice(0, 8)}...）`);
    await supabase.from('video_projects').update({
      pipeline_logs: logs,
      status: 'generating_video',
    }).eq('id', params.videoProjectId);

    return NextResponse.json({ ok: true, taskId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

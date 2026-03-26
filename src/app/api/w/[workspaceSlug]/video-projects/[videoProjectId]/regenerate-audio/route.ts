import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getWorkspaceWithAuth, errorResponse } from '@/lib/api-helpers';
import { generateNarration } from '@/lib/video/api/elevenlabs';

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

  const narrationText = scene.narration_text;
  if (!narrationText) return errorResponse('bad_request', 'Scene has no narration text', 400);

  // Get project voice type
  const { data: project } = await supabase
    .from('video_projects')
    .select('voice_type, pipeline_logs')
    .eq('id', params.videoProjectId)
    .single();

  const gender = (project?.voice_type || 'female') as 'male' | 'female';

  try {
    const audioBuffer = await generateNarration(narrationText, gender);

    // Estimate audio duration from MP3 buffer size
    const estimatedDuration = Math.ceil((audioBuffer.length * 8) / 128000);
    const videoDuration = estimatedDuration <= 5 ? 5 : 10;

    // Upload to storage
    const path = `video/${params.videoProjectId}/audio/${scene.scene_number}.mp3`;
    await supabase.storage.from('generated-assets').upload(path, audioBuffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    });
    const { data: urlData } = supabase.storage.from('generated-assets').getPublicUrl(path);

    // Update scene
    await supabase.from('video_scenes').update({
      audio_url: urlData.publicUrl + '?t=' + Date.now(), // cache bust
      duration: videoDuration,
      status: 'audio_ready',
    }).eq('id', sceneId);

    // Add log
    const logs = project?.pipeline_logs || [];
    logs.push(`[${new Date().toLocaleTimeString('ja-JP')}] 🔄 シーン${scene.scene_number} ナレーション再生成完了（音声${estimatedDuration}秒→動画${videoDuration}秒）`);
    await supabase.from('video_projects').update({ pipeline_logs: logs }).eq('id', params.videoProjectId);

    return NextResponse.json({ ok: true, duration: videoDuration });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

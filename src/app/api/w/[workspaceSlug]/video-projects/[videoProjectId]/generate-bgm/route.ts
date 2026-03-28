import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getWorkspaceWithAuth, errorResponse } from '@/lib/api-helpers';
import { generateBGM } from '@/lib/video/api/bgm';
import { checkAndDeductCredits } from '@/lib/credit-check';

export const maxDuration = 120;

export async function POST(req: NextRequest, { params }: { params: { workspaceSlug: string; videoProjectId: string } }) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const creditError = await checkAndDeductCredits(auth.workspace.id as string, 'BGM_GENERATION', 'BGM生成', auth.userEmail);
  if (creditError) return creditError;

  const supabase = createServerClient();

  // Get project info for context
  const { data: project } = await supabase
    .from('video_projects')
    .select('title, source_url, pipeline_logs')
    .eq('id', params.videoProjectId)
    .single();

  if (!project) return errorResponse('not_found', 'Project not found', 404);

  // Get scenes for context
  const { data: scenes } = await supabase
    .from('video_scenes')
    .select('description, narration_text')
    .eq('video_project_id', params.videoProjectId)
    .order('scene_number');

  // Build a prompt that captures the video's mood
  const sceneDescriptions = (scenes || [])
    .map((s: { description: string; narration_text: string }) => s.description || s.narration_text || '')
    .filter(Boolean)
    .join('. ');

  const contextSummary = sceneDescriptions.slice(0, 300);

  const prompt = `Create a 30-second instrumental background music track. No vocals, no singing, no lyrics.
The music should be subtle, professional, and suitable as background music for a video advertisement.
The mood should complement this video content: "${project.title || ''}". ${contextSummary ? `Context: ${contextSummary}` : ''}
Keep it calm and not overpowering - this will be mixed behind voice narration.
Style: Modern, clean, corporate/commercial feel with light melody.`;

  try {
    const audioBuffer = await generateBGM(prompt);

    // Upload to storage
    const path = `video/${params.videoProjectId}/bgm/bgm.mp3`;
    await supabase.storage.from('generated-assets').upload(path, audioBuffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    });
    const { data: urlData } = supabase.storage.from('generated-assets').getPublicUrl(path);
    const bgmUrl = urlData.publicUrl + '?t=' + Date.now();

    // Add log
    const logs = project.pipeline_logs || [];
    logs.push(`[${new Date().toLocaleTimeString('ja-JP')}] 🎵 BGM生成完了（Gemini Lyria 3）`);
    await supabase.from('video_projects').update({ pipeline_logs: logs }).eq('id', params.videoProjectId);

    return NextResponse.json({ ok: true, bgmUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('BGM generation error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

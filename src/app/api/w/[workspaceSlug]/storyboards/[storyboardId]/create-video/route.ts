import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: { workspaceSlug: string; storyboardId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const body = await req.json();
  const { voice_type, aspect_ratio } = body;

  // 1. Fetch storyboard
  const { data: storyboard } = await db
    .from('storyboards')
    .select('*')
    .eq('id', params.storyboardId)
    .single();

  if (!storyboard) return errorResponse('not_found', 'Storyboard not found', 404);

  // 2. Fetch latest draft
  const { data: draft } = await db
    .from('drafts')
    .select('*')
    .eq('storyboard_id', params.storyboardId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!draft) return errorResponse('not_found', 'Draft not found', 404);

  // 3. Fetch draft scenes
  const { data: scenes } = await db
    .from('draft_scenes')
    .select('*')
    .eq('draft_id', draft.id)
    .order('scene_order');

  if (!scenes || scenes.length === 0) {
    return errorResponse('validation', 'No scenes in storyboard');
  }

  // 4. Create video project with status 'images_ready' (skipping analyze/script/image stages)
  const { data: videoProject, error: vpError } = await db
    .from('video_projects')
    .insert({
      workspace_id: auth.workspace.id,
      project_id: storyboard.project_id || null,
      title: storyboard.title || '絵コンテからの動画',
      source_url: '',
      aspect_ratio: aspect_ratio || '9:16',
      voice_type: voice_type || 'female',
      status: 'images_ready',
      pipeline_logs: [`[${new Date().toLocaleTimeString('ja-JP')}] 絵コンテから動画プロジェクトを作成（台本・画像生成をスキップ）`],
    })
    .select()
    .single();

  if (vpError || !videoProject) {
    return NextResponse.json({ ok: false, error: vpError?.message || 'Failed to create video project' }, { status: 500 });
  }

  // 5. Create video_scenes from draft scenes (with images and narration already set)
  for (const scene of scenes) {
    await db.from('video_scenes').insert({
      video_project_id: videoProject.id,
      scene_number: scene.scene_order,
      narration_text: scene.dialogue || '',
      image_prompt: scene.description || '',
      description: scene.description || '',
      duration: 5,
      image_url: scene.image_url || null,
      status: scene.image_url ? 'image_ready' : 'pending',
    });
  }

  return NextResponse.json({ ok: true, data: videoProject });
}

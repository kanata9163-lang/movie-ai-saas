import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getWorkspaceWithAuth, errorResponse } from '@/lib/api-helpers';

// Update a scene
export async function PATCH(req: NextRequest, { params }: { params: { workspaceSlug: string; videoProjectId: string } }) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const supabase = createServerClient();
  const body = await req.json();
  const { sceneId, narration_text, description, image_prompt, duration, subtitle_text, subtitle_style } = body;

  if (!sceneId) return errorResponse('validation', 'sceneId is required');

  const update: Record<string, unknown> = {};
  if (narration_text !== undefined) update.narration_text = narration_text;
  if (description !== undefined) update.description = description;
  if (image_prompt !== undefined) update.image_prompt = image_prompt;
  if (duration !== undefined) update.duration = duration;
  if (subtitle_text !== undefined) update.subtitle_text = subtitle_text;
  if (subtitle_style !== undefined) update.subtitle_style = subtitle_style;

  if (Object.keys(update).length === 0) {
    return errorResponse('validation', 'No fields to update');
  }

  const { error } = await supabase
    .from('video_scenes')
    .update(update)
    .eq('id', sceneId)
    .eq('video_project_id', params.videoProjectId);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Regenerate script (re-run analyze+script)
export async function POST(req: NextRequest, { params }: { params: { workspaceSlug: string; videoProjectId: string } }) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const supabase = createServerClient();

  // Delete existing scenes and reset to pending
  await supabase.from('video_scenes').delete().eq('video_project_id', params.videoProjectId);
  await supabase.from('video_projects').update({
    status: 'pending',
    script: null,
    company_analysis: null,
    pipeline_logs: [],
    error_message: null,
    updated_at: new Date().toISOString(),
  }).eq('id', params.videoProjectId);

  return NextResponse.json({ ok: true });
}

import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; storyboardId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();

  // Get storyboard info
  const { data: storyboard, error: sbError } = await db
    .from('storyboards')
    .select('*')
    .eq('id', params.storyboardId)
    .single();

  if (sbError || !storyboard) return errorResponse('not_found', 'Storyboard not found', 404);

  // Get draft
  const { data: draft, error: draftError } = await db
    .from('drafts')
    .select('*')
    .eq('storyboard_id', params.storyboardId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (draftError || !draft) return errorResponse('not_found', 'Draft not found', 404);

  // Get scenes
  const { data: scenes } = await db
    .from('draft_scenes')
    .select('*')
    .eq('draft_id', draft.id)
    .order('scene_order');

  // Get published version info if exists
  let publishedVersion = null;
  if (storyboard.current_published_version_id) {
    const { data: version } = await db
      .from('storyboard_versions')
      .select('id, version_number')
      .eq('id', storyboard.current_published_version_id)
      .single();
    publishedVersion = version;
  }

  return jsonResponse({
    storyboard: {
      id: storyboard.id,
      title: storyboard.title,
      project_id: storyboard.project_id,
      current_published_version: publishedVersion,
    },
    draft: {
      id: draft.id,
      generation_config: draft.generation_config,
      base_version_id: draft.base_version_id,
    },
    scenes: scenes || [],
  });
}

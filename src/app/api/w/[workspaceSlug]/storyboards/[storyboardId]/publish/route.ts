import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; storyboardId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();

  // Get latest draft
  const { data: draft } = await db
    .from('drafts')
    .select('*')
    .eq('storyboard_id', params.storyboardId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!draft) return errorResponse('not_found', 'No draft found', 404);

  // Get current max version number
  const { data: versions } = await db
    .from('storyboard_versions')
    .select('version_number')
    .eq('storyboard_id', params.storyboardId)
    .order('version_number', { ascending: false })
    .limit(1);

  const nextVersion = (versions?.[0]?.version_number || 0) + 1;
  const versionId = uuidv4();

  // Create version
  await db.from('storyboard_versions').insert({
    id: versionId,
    storyboard_id: params.storyboardId,
    version_number: nextVersion,
    source: 'draft',
  });

  // Copy scenes to version
  const { data: scenes } = await db
    .from('draft_scenes')
    .select('*')
    .eq('draft_id', draft.id)
    .order('scene_order');

  if (scenes) {
    const versionScenes = scenes.map((s) => ({
      version_id: versionId,
      scene_order: s.scene_order,
      dialogue: s.dialogue,
      description: s.description,
      image_asset_id: s.image_asset_id,
    }));
    await db.from('version_scenes').insert(versionScenes);
  }

  // Update storyboard published version
  await db.from('storyboards').update({
    current_published_version_id: versionId,
    updated_at: new Date().toISOString(),
  }).eq('id', params.storyboardId);

  return jsonResponse({ version_id: versionId, version_number: nextVersion });
}

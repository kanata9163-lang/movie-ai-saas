import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';
import { sendSlackNotification } from '@/lib/integrations/slack';
import { sendLineNotification } from '@/lib/integrations/line';

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
  const { data: storyboard } = await db
    .from('storyboards')
    .select('title')
    .eq('id', params.storyboardId)
    .single();

  await db.from('storyboards').update({
    current_published_version_id: versionId,
    updated_at: new Date().toISOString(),
  }).eq('id', params.storyboardId);

  // Send notifications
  const wsId = auth.workspace.id as string;
  const title = storyboard?.title || '無題';
  const notifText = `\ud83d\udcdd \u7d75\u30b3\u30f3\u30c6\u300c${title}\u300d\u304cv${nextVersion}\u3067\u516c\u958b\u3055\u308c\u307e\u3057\u305f\uff01`;
  await Promise.all([
    sendSlackNotification(wsId, { text: notifText }),
    sendLineNotification(wsId, notifText),
  ]);

  return jsonResponse({ version_id: versionId, version_number: nextVersion });
}

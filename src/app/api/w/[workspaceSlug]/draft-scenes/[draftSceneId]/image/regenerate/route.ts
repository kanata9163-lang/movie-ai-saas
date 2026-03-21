import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse } from '@/lib/api-helpers';
import { generateSceneImage } from '@/lib/gemini';

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; draftSceneId: string } }
) {
  const db = getSupabase();

  const { data: scene, error: sceneError } = await db
    .from('draft_scenes')
    .select('*')
    .eq('id', params.draftSceneId)
    .single();

  if (sceneError || !scene) return errorResponse('not_found', 'Scene not found', 404);
  if (!scene.image_prompt) return errorResponse('validation', 'Scene has no image prompt');

  try {
    const { data: draft } = await db
      .from('drafts')
      .select('generation_config')
      .eq('id', scene.draft_id)
      .single();

    const negativePrompt = scene.regen_config_override?.negative_prompt
      || draft?.generation_config?.negative_prompt
      || '';

    const imageDataUrl = await generateSceneImage(scene.image_prompt, negativePrompt);

    await db
      .from('draft_scenes')
      .update({
        image_url: imageDataUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.draftSceneId);

    return jsonResponse({ image_url: imageDataUrl });
  } catch (error) {
    console.error('Image regeneration error:', error);
    return errorResponse(
      'generation_error',
      `Failed to regenerate image: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}

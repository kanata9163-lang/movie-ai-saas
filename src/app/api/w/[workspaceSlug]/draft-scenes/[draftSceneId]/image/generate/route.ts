import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse } from '@/lib/api-helpers';
import { generateSceneImage } from '@/lib/gemini';

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; draftSceneId: string } }
) {
  const db = getSupabase();

  // Get scene
  const { data: scene, error: sceneError } = await db
    .from('draft_scenes')
    .select('*')
    .eq('id', params.draftSceneId)
    .single();

  if (sceneError || !scene) return errorResponse('not_found', 'Scene not found', 404);

  if (!scene.image_prompt) {
    return errorResponse('validation', 'Scene has no image prompt');
  }

  try {
    // Get draft config for negative prompt
    const { data: draft } = await db
      .from('drafts')
      .select('generation_config')
      .eq('id', scene.draft_id)
      .single();

    const negativePrompt = draft?.generation_config?.negative_prompt || '';

    // Generate image using Gemini
    const imageDataUrl = await generateSceneImage(scene.image_prompt, negativePrompt);

    // Store the image URL directly (base64 data URL for now)
    await db
      .from('draft_scenes')
      .update({
        image_url: imageDataUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.draftSceneId);

    return jsonResponse({ image_url: imageDataUrl });
  } catch (error) {
    console.error('Image generation error:', error);
    return errorResponse(
      'generation_error',
      `Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}

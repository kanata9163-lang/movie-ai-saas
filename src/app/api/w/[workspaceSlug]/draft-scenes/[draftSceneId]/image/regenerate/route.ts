import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse } from '@/lib/api-helpers';
import { generateSceneImage, type ReferenceImage } from '@/lib/gemini';

export const maxDuration = 60;

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
      .select('generation_config, storyboard_id')
      .eq('id', scene.draft_id)
      .single();

    const negativePrompt = scene.regen_config_override?.negative_prompt
      || draft?.generation_config?.negative_prompt
      || '';
    const aspectRatio = draft?.generation_config?.image_aspect || '';
    const imageStyle = draft?.generation_config?.image_style || '';

    // Fetch elements from DB
    let referenceImages: ReferenceImage[] = [];
    if (draft?.storyboard_id) {
      const { data: storyboard } = await db
        .from('storyboards')
        .select('project_id')
        .eq('id', draft.storyboard_id)
        .single();

      if (storyboard?.project_id) {
        const { data: elements } = await db
          .from('project_elements')
          .select('mime_type, image_data')
          .eq('project_id', storyboard.project_id);

        if (elements && elements.length > 0) {
          referenceImages = elements.map((el) => {
            const match = el.image_data.match(/^data:(.*?);base64,(.*)$/);
            if (match) {
              return { mimeType: match[1], data: match[2] };
            }
            return { mimeType: el.mime_type, data: el.image_data };
          });
        }
      }
    }

    const imageDataUrl = await generateSceneImage(
      scene.image_prompt,
      negativePrompt,
      aspectRatio,
      referenceImages,
      imageStyle
    );

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

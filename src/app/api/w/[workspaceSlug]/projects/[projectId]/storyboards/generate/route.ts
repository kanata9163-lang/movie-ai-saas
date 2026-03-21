import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceBySlug } from '@/lib/api-helpers';
import { generateStoryboardScenes, type StoryboardGenerateParams } from '@/lib/gemini';

// Increase timeout for AI generation (Vercel Hobby: max 60s)
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const db = getSupabase();
  const workspace = await getWorkspaceBySlug(params.workspaceSlug);
  if (!workspace) return errorResponse('not_found', 'Workspace not found', 404);

  const body: StoryboardGenerateParams = await request.json();
  if (!body.title) return errorResponse('validation', 'title is required');
  if (!body.config) return errorResponse('validation', 'config is required');

  try {
    // Create storyboard
    const storyboardId = uuidv4();
    const draftId = uuidv4();
    const jobId = uuidv4();

    // Create job
    await db.from('jobs').insert({
      id: jobId,
      workspace_id: workspace.id,
      type: 'storyboard_generation',
      status: 'running',
      progress: 0,
    });

    // Create storyboard
    await db.from('storyboards').insert({
      id: storyboardId,
      project_id: params.projectId,
      workspace_id: workspace.id,
      title: body.title,
    });

    // Create draft
    await db.from('drafts').insert({
      id: draftId,
      storyboard_id: storyboardId,
      generation_config: body.config,
    });

    // Generate scenes using Gemini (async - but we'll do it sync for simplicity)
    const scenes = await generateStoryboardScenes(body);

    // Update job progress
    await db.from('jobs').update({ progress: 50 }).eq('id', jobId);

    // Insert scenes
    const sceneInserts = scenes.map((scene, idx) => ({
      draft_id: draftId,
      scene_order: scene.scene_order || idx + 1,
      dialogue: scene.dialogue || null,
      description: scene.description || null,
      image_prompt: scene.image_prompt || null,
    }));

    await db.from('draft_scenes').insert(sceneInserts);

    // Mark job complete
    await db.from('jobs').update({
      status: 'completed',
      progress: 100,
      result: { storyboard_id: storyboardId, draft_id: draftId },
      updated_at: new Date().toISOString(),
    }).eq('id', jobId);

    return jsonResponse({
      storyboardId,
      draftId,
      jobId,
    }, 201);
  } catch (error) {
    console.error('Storyboard generation error:', error);
    return errorResponse('generation_error', `Failed to generate storyboard: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
  }
}

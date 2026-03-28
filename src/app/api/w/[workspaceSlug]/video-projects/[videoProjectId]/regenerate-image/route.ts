import { NextRequest, NextResponse } from 'next/server';
import { regenerateSceneImage } from '@/lib/video/pipeline/orchestrator';
import { getWorkspaceWithAuth, errorResponse } from '@/lib/api-helpers';
import { checkAndDeductCredits } from '@/lib/credit-check';

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: { workspaceSlug: string; videoProjectId: string } }) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const { sceneId } = await req.json();
  if (!sceneId) return NextResponse.json({ error: 'sceneId required' }, { status: 400 });

  const creditError = await checkAndDeductCredits(auth.workspace.id as string, 'IMAGE_REGENERATION', '画像再生成', auth.userEmail);
  if (creditError) return creditError;

  const result = await regenerateSceneImage(params.videoProjectId, sceneId);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, imageUrl: result.imageUrl });
}

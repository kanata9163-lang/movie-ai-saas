import { NextRequest, NextResponse } from 'next/server';
import { runImageGeneration } from '@/lib/video/pipeline/orchestrator';
import { getWorkspaceWithAuth, errorResponse } from '@/lib/api-helpers';
import { checkAndDeductCredits } from '@/lib/credit-check';

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: { workspaceSlug: string; videoProjectId: string } }) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const creditError = await checkAndDeductCredits(auth.workspace.id as string, 'IMAGE_GENERATION', '動画シーン画像生成');
  if (creditError) return creditError;

  const result = await runImageGeneration(params.videoProjectId);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, allDone: result.allDone });
}

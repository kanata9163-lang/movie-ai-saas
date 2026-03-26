import { NextRequest, NextResponse } from 'next/server';
import { checkVideoTasks } from '@/lib/video/pipeline/orchestrator';
import { getWorkspaceWithAuth, errorResponse } from '@/lib/api-helpers';

export const maxDuration = 30;

export async function GET(req: NextRequest, { params }: { params: { workspaceSlug: string; videoProjectId: string } }) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const result = await checkVideoTasks(params.videoProjectId);
  return NextResponse.json({ ok: true, ...result });
}

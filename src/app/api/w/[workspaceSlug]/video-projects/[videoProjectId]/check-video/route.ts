import { NextRequest, NextResponse } from 'next/server';
import { checkVideoTasks } from '@/lib/video/pipeline/orchestrator';

export const maxDuration = 30;

export async function GET(req: NextRequest, { params }: { params: { videoProjectId: string } }) {
  const result = await checkVideoTasks(params.videoProjectId);
  return NextResponse.json({ ok: true, ...result });
}

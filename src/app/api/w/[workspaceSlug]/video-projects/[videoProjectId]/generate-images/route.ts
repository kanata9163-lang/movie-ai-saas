import { NextRequest, NextResponse } from 'next/server';
import { runImageGeneration } from '@/lib/video/pipeline/orchestrator';

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: { videoProjectId: string } }) {
  const result = await runImageGeneration(params.videoProjectId);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, allDone: result.allDone });
}

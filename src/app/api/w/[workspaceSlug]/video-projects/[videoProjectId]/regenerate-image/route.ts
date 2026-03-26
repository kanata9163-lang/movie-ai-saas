import { NextRequest, NextResponse } from 'next/server';
import { regenerateSceneImage } from '@/lib/video/pipeline/orchestrator';

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: { videoProjectId: string } }) {
  const { sceneId } = await req.json();
  if (!sceneId) return NextResponse.json({ error: 'sceneId required' }, { status: 400 });

  const result = await regenerateSceneImage(params.videoProjectId, sceneId);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, imageUrl: result.imageUrl });
}

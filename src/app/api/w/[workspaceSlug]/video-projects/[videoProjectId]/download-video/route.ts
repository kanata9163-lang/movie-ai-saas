import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getWorkspaceWithAuth, errorResponse } from '@/lib/api-helpers';

export const maxDuration = 60;

// Proxy video download to bypass CORS restrictions from Runway CDN
export async function GET(
  req: NextRequest,
  { params }: { params: { workspaceSlug: string; videoProjectId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const sceneId = searchParams.get('sceneId');

  if (!sceneId) {
    return NextResponse.json({ error: 'sceneId required' }, { status: 400 });
  }

  const { data: scene } = await supabase
    .from('video_scenes')
    .select('video_url, scene_number, audio_url')
    .eq('id', sceneId)
    .eq('video_project_id', params.videoProjectId)
    .single();

  if (!scene?.video_url) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  const type = searchParams.get('type') || 'video';
  const url = type === 'audio' ? scene.audio_url : scene.video_url;
  if (!url) {
    return NextResponse.json({ error: `${type} not found` }, { status: 404 });
  }

  const resp = await fetch(url);
  if (!resp.ok) {
    return NextResponse.json({ error: 'Failed to fetch from CDN' }, { status: 502 });
  }

  const contentType = type === 'audio' ? 'audio/mpeg' : 'video/mp4';
  const ext = type === 'audio' ? 'mp3' : 'mp4';
  const buffer = await resp.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="scene_${scene.scene_number}.${ext}"`,
      'Content-Length': buffer.byteLength.toString(),
    },
  });
}

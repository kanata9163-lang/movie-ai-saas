import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getWorkspaceWithAuth, errorResponse } from '@/lib/api-helpers';

export async function POST(req: NextRequest, { params }: { params: { workspaceSlug: string; videoProjectId: string } }) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const supabase = createServerClient();
  await supabase.from('video_projects').update({
    status: 'completed',
    updated_at: new Date().toISOString(),
  }).eq('id', params.videoProjectId);

  return NextResponse.json({ ok: true });
}

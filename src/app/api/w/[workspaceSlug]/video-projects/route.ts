import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getWorkspaceWithAuth, errorResponse } from '@/lib/api-helpers';

export async function GET(req: NextRequest, { params }: { params: { workspaceSlug: string } }) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('video_projects')
    .select('*, video_scenes(count)')
    .eq('workspace_id', auth.workspace.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data }, {
    headers: { 'Cache-Control': 'private, s-maxage=15, stale-while-revalidate=75' },
  });
}

export async function POST(req: NextRequest, { params }: { params: { workspaceSlug: string } }) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const supabase = createServerClient();
  const body = await req.json();

  const { data, error } = await supabase
    .from('video_projects')
    .insert({
      workspace_id: auth.workspace.id,
      project_id: body.project_id || null,
      title: body.title || '',
      source_url: body.source_url || null,
      aspect_ratio: body.aspect_ratio || '9:16',
      voice_type: body.voice_type || 'female',
      voice_style: body.voice_style || 'energetic',
      custom_instructions: body.custom_instructions || '',
      status: 'pending',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

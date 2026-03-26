import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getWorkspaceBySlug } from '@/lib/api-helpers';

export async function GET(req: NextRequest, { params }: { params: { workspaceSlug: string } }) {
  const supabase = createServerClient();
  const workspace = await getWorkspaceBySlug(params.workspaceSlug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('video_projects')
    .select('*, video_scenes(count)')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: NextRequest, { params }: { params: { workspaceSlug: string } }) {
  const supabase = createServerClient();
  const workspace = await getWorkspaceBySlug(params.workspaceSlug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const body = await req.json();

  const { data, error } = await supabase
    .from('video_projects')
    .insert({
      workspace_id: workspace.id,
      project_id: body.project_id || null,
      title: body.title || '',
      source_url: body.source_url || '',
      aspect_ratio: body.aspect_ratio || '9:16',
      voice_type: body.voice_type || 'female',
      status: 'pending',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

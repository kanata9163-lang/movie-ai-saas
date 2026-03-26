import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest, { params }: { params: { videoProjectId: string } }) {
  const supabase = createServerClient();

  const { data: project, error } = await supabase
    .from('video_projects')
    .select('*')
    .eq('id', params.videoProjectId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const { data: scenes } = await supabase
    .from('video_scenes')
    .select('*')
    .eq('video_project_id', params.videoProjectId)
    .order('scene_number');

  const { data: refImages } = await supabase
    .from('video_reference_images')
    .select('id, image_type, name, created_at')
    .eq('video_project_id', params.videoProjectId);

  return NextResponse.json({ ok: true, data: { ...project, scenes: scenes || [], reference_images: refImages || [] } });
}

export async function PATCH(req: NextRequest, { params }: { params: { videoProjectId: string } }) {
  const supabase = createServerClient();
  const body = await req.json();

  const { data, error } = await supabase
    .from('video_projects')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.videoProjectId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: NextRequest, { params }: { params: { videoProjectId: string } }) {
  const supabase = createServerClient();
  const { error } = await supabase.from('video_projects').delete().eq('id', params.videoProjectId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

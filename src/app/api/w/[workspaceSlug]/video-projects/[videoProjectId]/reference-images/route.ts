import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest, { params }: { params: { videoProjectId: string } }) {
  const supabase = createServerClient();
  const body = await req.json();

  // Check max 4
  const { count } = await supabase
    .from('video_reference_images')
    .select('*', { count: 'exact', head: true })
    .eq('video_project_id', params.videoProjectId);

  if ((count || 0) >= 4) {
    return NextResponse.json({ error: '参照画像は最大4枚までです' }, { status: 400 });
  }

  // Extract MIME type from data URL if present
  let mimeType = body.mime_type || 'image/png';
  if (body.image_data && body.image_data.startsWith('data:')) {
    const match = body.image_data.match(/^data:([^;]+);/);
    if (match) mimeType = match[1];
  }

  const { data, error } = await supabase
    .from('video_reference_images')
    .insert({
      video_project_id: params.videoProjectId,
      image_type: body.image_type || 'other',
      image_data: body.image_data,
      mime_type: mimeType,
      name: body.name || '',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const imageId = searchParams.get('imageId');

  if (!imageId) return NextResponse.json({ error: 'imageId required' }, { status: 400 });

  const { error } = await supabase.from('video_reference_images').delete().eq('id', imageId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

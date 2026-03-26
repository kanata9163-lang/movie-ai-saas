import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getWorkspaceBySlug } from '@/lib/api-helpers';

export async function GET(req: NextRequest, { params }: { params: { workspaceSlug: string; id: string } }) {
  const supabase = createServerClient();
  const workspace = await getWorkspaceBySlug(params.workspaceSlug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('knowledge_items')
    .select('*')
    .eq('id', params.id)
    .eq('workspace_id', workspace.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function PATCH(req: NextRequest, { params }: { params: { workspaceSlug: string; id: string } }) {
  const supabase = createServerClient();
  const workspace = await getWorkspaceBySlug(params.workspaceSlug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const body = await req.json();

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) updateData.title = body.title;
  if (body.content_text !== undefined) updateData.content_text = body.content_text;
  if (body.tags !== undefined) updateData.tags = body.tags;
  if (body.metadata !== undefined) updateData.metadata = body.metadata;

  const { data, error } = await supabase
    .from('knowledge_items')
    .update(updateData)
    .eq('id', params.id)
    .eq('workspace_id', workspace.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: NextRequest, { params }: { params: { workspaceSlug: string; id: string } }) {
  const supabase = createServerClient();
  const workspace = await getWorkspaceBySlug(params.workspaceSlug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const { error } = await supabase
    .from('knowledge_items')
    .delete()
    .eq('id', params.id)
    .eq('workspace_id', workspace.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

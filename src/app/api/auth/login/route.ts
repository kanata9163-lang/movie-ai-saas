import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import { initializeCredits } from '@/lib/credits';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: { code: 'validation', message: 'Email and password are required' } },
      { status: 400 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: 'auth_error', message: error.message } },
      { status: 401 }
    );
  }

  // Get user's workspace
  const db = createServerClient();
  const { data: memberships } = await db
    .from('workspace_members')
    .select('workspace_id, workspaces(id, slug, name)')
    .eq('user_id', data.user.id);

  let workspaceSlug = '';
  if (memberships && memberships.length > 0) {
    const ws = (memberships[0] as Record<string, unknown>).workspaces as { slug: string } | null;
    if (ws) workspaceSlug = ws.slug;
  }

  // Create workspace for users who don't have one
  if (!workspaceSlug) {
    const { v4: uuidv4 } = await import('uuid');
    const displayName = data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'user';
    const baseSlug = displayName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 12) || 'ws';
    const slug = `${baseSlug}-${uuidv4().slice(0, 8)}`;
    const { data: ws } = await db
      .from('workspaces')
      .insert({ name: `${displayName}のワークスペース`, slug })
      .select()
      .single();
    if (ws) {
      await db.from('workspace_members').insert({
        workspace_id: ws.id,
        user_id: data.user.id,
        role: 'owner',
      });
      workspaceSlug = ws.slug;
      await initializeCredits(ws.id);
    }
  }

  const response = NextResponse.json({
    ok: true,
    data: {
      user: data.user,
      session: data.session,
      workspaceSlug,
    },
  });

  // Set auth cookie
  if (data.session) {
    response.cookies.set('sb-access-token', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });
    response.cookies.set('sb-refresh-token', data.session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });
    response.cookies.set('sb-user-id', data.user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
  }

  return response;
}

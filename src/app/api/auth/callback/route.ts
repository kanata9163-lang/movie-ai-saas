import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', request.url));
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
  }

  // Get or create workspace for user
  const db = createServerClient();
  const { data: memberships } = await db
    .from('workspace_members')
    .select('workspace_id, workspaces(id, slug, name)')
    .eq('user_id', data.user.id);

  let workspaceSlug = '';

  if (!memberships || memberships.length === 0) {
    // Create workspace for new Google user with unique slug
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
    }
  } else {
    const ws = (memberships[0] as Record<string, unknown>).workspaces as { slug: string } | null;
    if (ws) workspaceSlug = ws.slug;
  }

  const response = NextResponse.redirect(new URL(`/w/${workspaceSlug}`, request.url));

  // Set auth cookies
  response.cookies.set('sb-access-token', data.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  response.cookies.set('sb-refresh-token', data.session.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  response.cookies.set('sb-user-id', data.user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  // Store Google provider token for Sheets API access
  if (data.session.provider_token) {
    response.cookies.set('google-access-token', data.session.provider_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour (Google tokens expire)
      path: '/',
    });
  }
  if (data.session.provider_refresh_token) {
    response.cookies.set('google-refresh-token', data.session.provider_refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
  }

  return response;
}

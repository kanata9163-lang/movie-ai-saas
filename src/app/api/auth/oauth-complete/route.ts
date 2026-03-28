import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';
import { initializeCredits } from '@/lib/credits';

export async function POST(request: NextRequest) {
  const { access_token, refresh_token, user_id, provider_token, provider_refresh_token } = await request.json();

  if (!access_token || !user_id) {
    return NextResponse.json(
      { ok: false, error: { code: 'validation', message: 'Missing required fields' } },
      { status: 400 }
    );
  }

  // Get or create workspace
  const db = createServerClient();
  const { data: memberships } = await db
    .from('workspace_members')
    .select('workspace_id, workspaces(id, slug, name)')
    .eq('user_id', user_id);

  let workspaceSlug = '';

  if (!memberships || memberships.length === 0) {
    // Look up user info
    const { data: userData } = await db.auth.admin.getUserById(user_id);
    const displayName = userData?.user?.user_metadata?.full_name || userData?.user?.email?.split('@')[0] || 'user';
    // Always generate a unique slug using UUID to prevent collision
    const baseSlug = displayName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 12) || 'ws';
    const slug = `${baseSlug}-${uuidv4().slice(0, 8)}`;

    // Always create a NEW workspace - never join an existing one by slug collision
    const { data: ws } = await db
      .from('workspaces')
      .insert({ name: `${displayName}のワークスペース`, slug })
      .select()
      .single();

    if (ws) {
      await db.from('workspace_members').insert({
        workspace_id: ws.id,
        user_id: user_id,
        role: 'owner',
      });
      workspaceSlug = ws.slug;
      // Grant initial free credits
      await initializeCredits(ws.id);
    }
  } else {
    const ws = (memberships[0] as Record<string, unknown>).workspaces as { slug: string } | null;
    if (ws) workspaceSlug = ws.slug;
  }

  const response = NextResponse.json({
    ok: true,
    data: { workspaceSlug },
  });

  // Set auth cookies
  response.cookies.set('sb-access-token', access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  if (refresh_token) {
    response.cookies.set('sb-refresh-token', refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
  }
  response.cookies.set('sb-user-id', user_id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  // Google provider tokens
  if (provider_token) {
    response.cookies.set('google-access-token', provider_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60,
      path: '/',
    });
  }
  if (provider_refresh_token) {
    response.cookies.set('google-refresh-token', provider_refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
  }

  return response;
}

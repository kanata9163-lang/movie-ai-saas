import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

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

  // Supabase signup - auto-confirm for dev (set in Supabase dashboard)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/`,
    }
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: 'auth_error', message: error.message } },
      { status: 400 }
    );
  }

  let workspaceSlug = 'demo';

  // Create a default workspace for the user
  if (data.user) {
    const db = createServerClient();
    const slug = uuidv4().slice(0, 8);
    const { data: workspace } = await db
      .from('workspaces')
      .insert({
        name: 'マイワークスペース',
        slug,
        account_type: 'free',
      })
      .select()
      .single();

    if (workspace) {
      workspaceSlug = workspace.slug;
      await db.from('workspace_members').insert({
        workspace_id: workspace.id,
        user_id: data.user.id,
        role: 'owner',
      });
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

  // Set auth cookies if session exists (auto-confirm enabled)
  if (data.session) {
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
    response.cookies.set('sb-user-id', data.user!.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
  }

  return response;
}

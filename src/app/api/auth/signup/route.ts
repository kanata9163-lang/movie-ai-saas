import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';
import { initializeCredits } from '@/lib/credits';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: { code: 'validation', message: 'メールアドレスとパスワードは必須です' } },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { ok: false, error: { code: 'validation', message: 'パスワードは6文字以上にしてください' } },
      { status: 400 }
    );
  }

  const db = createServerClient(); // service_role client

  // Use admin API to create user with auto-confirm
  const { data: adminData, error: adminError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm
  });

  if (adminError) {
    return NextResponse.json(
      { ok: false, error: { code: 'auth_error', message: adminError.message } },
      { status: 400 }
    );
  }

  if (!adminData.user) {
    return NextResponse.json(
      { ok: false, error: { code: 'auth_error', message: 'ユーザー作成に失敗しました' } },
      { status: 500 }
    );
  }

  // Create a default workspace for the user
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

  let workspaceSlug = '';
  if (workspace) {
    workspaceSlug = workspace.slug;
    await db.from('workspace_members').insert({
      workspace_id: workspace.id,
      user_id: adminData.user.id,
      role: 'owner',
    });
    // Grant initial free credits (1000)
    await initializeCredits(workspace.id);
  }

  // Sign in the user to get a session
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signInData.session) {
    // User created but login failed - still return success
    return NextResponse.json({
      ok: true,
      data: {
        user: adminData.user,
        session: null,
        workspaceSlug,
        message: 'ユーザーが作成されました。ログインしてください。',
      },
    });
  }

  const response = NextResponse.json({
    ok: true,
    data: {
      user: signInData.user,
      session: signInData.session,
      workspaceSlug,
    },
  });

  // Set auth cookies
  response.cookies.set('sb-access-token', signInData.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  response.cookies.set('sb-refresh-token', signInData.session.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  response.cookies.set('sb-user-id', signInData.user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  return response;
}

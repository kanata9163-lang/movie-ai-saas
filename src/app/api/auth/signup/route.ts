import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

  const origin = request.nextUrl.origin;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: 'auth_error', message: error.message } },
      { status: 400 }
    );
  }

  if (!data.user) {
    return NextResponse.json(
      { ok: false, error: { code: 'auth_error', message: 'ユーザー作成に失敗しました' } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      user: data.user,
      emailConfirmationRequired: !data.session,
    },
  });
}

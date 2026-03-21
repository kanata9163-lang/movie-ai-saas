import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('sb-access-token')?.value;

  if (!token) {
    return NextResponse.json(
      { ok: false, error: { code: 'unauthorized', message: 'Not logged in' } },
      { status: 401 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return NextResponse.json(
      { ok: false, error: { code: 'unauthorized', message: 'Invalid session' } },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      id: data.user.id,
      email: data.user.email,
    },
  });
}

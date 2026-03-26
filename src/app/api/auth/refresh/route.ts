import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get('sb-refresh-token')?.value;
  const accessToken = request.cookies.get('sb-access-token')?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { ok: false, error: 'No refresh token' },
      { status: 401 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // First try: if access token exists, check if it's still valid
  if (accessToken) {
    const { data: userData } = await supabase.auth.getUser(accessToken);
    if (userData.user) {
      // Token is still valid, no refresh needed
      return NextResponse.json({ ok: true, refreshed: false });
    }
  }

  // Access token expired or missing - use refresh token to get new session
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

  if (error || !data.session) {
    // Refresh token is also invalid - clear cookies and force re-login
    const response = NextResponse.json(
      { ok: false, error: 'Session expired, please log in again' },
      { status: 401 }
    );
    response.cookies.delete('sb-access-token');
    response.cookies.delete('sb-refresh-token');
    response.cookies.delete('sb-user-id');
    return response;
  }

  // Set new cookies with refreshed tokens
  const response = NextResponse.json({ ok: true, refreshed: true });

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
  if (data.user) {
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

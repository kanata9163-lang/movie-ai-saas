import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('sb-access-token')?.value;
  const refreshToken = request.cookies.get('sb-refresh-token')?.value;

  if (!token && !refreshToken) {
    return NextResponse.json(
      { ok: false, error: { code: 'unauthorized', message: 'Not logged in' } },
      { status: 401 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Try with current access token
  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) {
      return NextResponse.json({
        ok: true,
        data: { id: data.user.id, email: data.user.email },
      }, {
        headers: { 'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300' },
      });
    }
  }

  // Access token expired - try refresh
  if (refreshToken) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (!refreshError && refreshData.session && refreshData.user) {
      const response = NextResponse.json({
        ok: true,
        data: { id: refreshData.user.id, email: refreshData.user.email },
      }, {
        headers: { 'Cache-Control': 'no-cache' },
      });

      // Update cookies with new tokens
      response.cookies.set('sb-access-token', refreshData.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
      response.cookies.set('sb-refresh-token', refreshData.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      });
      response.cookies.set('sb-user-id', refreshData.user.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });

      return response;
    }
  }

  // Both tokens invalid
  const response = NextResponse.json(
    { ok: false, error: { code: 'unauthorized', message: 'Session expired' } },
    { status: 401 }
  );
  response.cookies.delete('sb-access-token');
  response.cookies.delete('sb-refresh-token');
  response.cookies.delete('sb-user-id');
  return response;
}

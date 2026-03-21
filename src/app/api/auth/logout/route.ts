import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ ok: true, data: null });
  response.cookies.delete('sb-access-token');
  response.cookies.delete('sb-refresh-token');
  response.cookies.delete('sb-user-id');
  return response;
}

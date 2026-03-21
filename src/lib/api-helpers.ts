import { NextResponse } from 'next/server';
import { createServerClient } from './supabase/server';

export function getSupabase() {
  return createServerClient();
}

export function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data, error: null }, { status });
}

export function errorResponse(code: string, message: string, status = 400) {
  return NextResponse.json(
    { ok: false, data: null, error: { code, message } },
    { status }
  );
}

export async function getWorkspaceBySlug(slug: string) {
  const db = getSupabase();
  const { data, error } = await db
    .from('workspaces')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) return null;
  return data;
}

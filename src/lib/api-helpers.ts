import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from './supabase/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export function getSupabase() {
  return createServerClient();
}

export function jsonResponse(data: unknown, status = 200, cacheSeconds?: number) {
  const headers: Record<string, string> = {};
  if (cacheSeconds) {
    headers['Cache-Control'] = `private, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 5}`;
  }
  return NextResponse.json({ ok: true, data, error: null }, { status, headers });
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
    .select('id, name, slug, created_at, updated_at')
    .eq('slug', slug)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Get the authenticated user from request cookies.
 * Returns user object or null if not authenticated.
 */
export async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('sb-access-token')?.value;
  if (!token) return null;

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return data.user;
}

/**
 * Verify that the authenticated user is a member of the workspace.
 * Returns { workspace, role, userId } or null if unauthorized.
 */
export async function getWorkspaceWithAuth(
  slug: string,
  request: NextRequest
): Promise<{ workspace: Record<string, unknown>; role: string; userId: string; userEmail: string } | null> {
  const user = await getAuthUser(request);
  if (!user) return null;

  const db = getSupabase();

  const { data: workspace, error: wsError } = await db
    .from('workspaces')
    .select('id, name, slug, created_at, updated_at')
    .eq('slug', slug)
    .single();

  if (wsError || !workspace) return null;

  const { data: membership, error: memError } = await db
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace.id)
    .eq('user_id', user.id)
    .single();

  if (memError || !membership) return null;

  return { workspace, role: membership.role, userId: user.id, userEmail: user.email || '' };
}

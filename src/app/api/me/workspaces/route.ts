import { getSupabase, jsonResponse, errorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getSupabase();

  // For now, return all workspaces (auth will filter later)
  const { data, error } = await db
    .from('workspaces')
    .select('*')
    .order('created_at');

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse({ items: data });
}

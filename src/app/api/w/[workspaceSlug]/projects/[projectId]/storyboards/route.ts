import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const db = getSupabase();
  const { data, error } = await db
    .from('storyboards')
    .select('*')
    .eq('project_id', params.projectId)
    .order('created_at', { ascending: false });

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data);
}

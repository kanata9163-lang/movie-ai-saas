import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; jobId: string } }
) {
  const db = getSupabase();
  const { data, error } = await db
    .from('jobs')
    .select('*')
    .eq('id', params.jobId)
    .single();

  if (error || !data) return errorResponse('not_found', 'Job not found', 404);
  return jsonResponse(data);
}

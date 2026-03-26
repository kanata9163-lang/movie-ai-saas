import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; projectId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const projectId = params.projectId;

  const [adRes, trendRes, knowledgeRes, videoRes] = await Promise.all([
    db.from('ad_analyses').select('id, query, platform, created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
    db.from('trend_reports').select('id, topic, platform, created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
    db.from('knowledge_items').select('id, title, type, created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
    db.from('video_projects').select('id, title, status, created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
  ]);

  return jsonResponse({
    adAnalyses: adRes.data || [],
    trendReports: trendRes.data || [],
    knowledgeItems: knowledgeRes.data || [],
    videoProjects: videoRes.data || [],
  });
}

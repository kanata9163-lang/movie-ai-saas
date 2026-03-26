import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const workspace = auth.workspace;
  const wsId = workspace.id as string;

  // Run all independent queries in parallel for speed
  const [
    projectsResult,
    recentTasksResult,
    totalProjectsResult,
    activeProjectsCountResult,
    completedProjectsResult,
    videoProjectsCountRes,
    knowledgeCountRes,
    assetsCountRes,
    recentVideoProjectsRes,
    recentStoryboardsRes,
    recentAdAnalysesRes,
    integrationsRes,
    allWsProjectsRes,
  ] = await Promise.all([
    db.from('projects')
      .select('id, name, status, client_id, created_at')
      .eq('workspace_id', wsId)
      .in('status', ['対応中', '進行中'])
      .order('created_at', { ascending: false })
      .limit(5),
    db.from('tasks')
      .select('id, project_id, title, is_completed, end_date, assignee_name')
      .order('created_at', { ascending: false })
      .limit(10),
    db.from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', wsId),
    db.from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', wsId)
      .in('status', ['対応中', '進行中']),
    db.from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', wsId)
      .eq('status', '完了'),
    // Video projects count
    db.from('video_projects')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', wsId),
    // Knowledge count
    db.from('knowledge_items')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', wsId),
    // Assets count
    db.from('assets')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', wsId),
    // Recent video projects
    db.from('video_projects')
      .select('id, title, status, created_at')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false })
      .limit(3),
    // Recent storyboards
    db.from('storyboards')
      .select('id, title, created_at, project_id, current_published_version_id')
      .order('created_at', { ascending: false })
      .limit(20),
    // Recent ad analyses
    db.from('ad_analyses')
      .select('id, query, platform, created_at')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false })
      .limit(3),
    // Integrations status
    db.from('integrations')
      .select('type, enabled')
      .eq('workspace_id', wsId),
    // All workspace project IDs
    db.from('projects')
      .select('id')
      .eq('workspace_id', wsId),
  ]);

  const projects = projectsResult.data || [];
  const recentTasks = recentTasksResult.data || [];
  const allProjectIds = (allWsProjectsRes.data || []).map((p: { id: string }) => p.id);

  // Batch fetch client names for active projects
  const clientIds = Array.from(new Set(projects.filter(p => p.client_id).map(p => p.client_id)));
  const clientMap = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data: clients } = await db
      .from('clients')
      .select('id, name')
      .in('id', clientIds);
    for (const c of clients || []) {
      clientMap.set(c.id, c.name);
    }
  }

  // Batch fetch task counts for active projects
  const activeProjects = await Promise.all(
    projects.map(async (p) => {
      const [totalResult, completedResult] = await Promise.all([
        db.from('tasks').select('id', { count: 'exact', head: true }).eq('project_id', p.id),
        db.from('tasks').select('id', { count: 'exact', head: true }).eq('project_id', p.id).eq('is_completed', true),
      ]);
      const total = totalResult.count || 0;
      const completed = completedResult.count || 0;
      return {
        id: p.id,
        name: p.name,
        progress: total > 0 ? Math.round((completed / total) * 100) : 0,
        total_tasks: total,
        completed_tasks: completed,
        client_name: p.client_id ? (clientMap.get(p.client_id) || null) : null,
        deadline: null,
      };
    })
  );

  // Batch fetch project names for recent tasks
  const taskProjectIds = Array.from(new Set(recentTasks.map(t => t.project_id)));
  const projectNameMap = new Map<string, string>();
  if (taskProjectIds.length > 0) {
    const { data: taskProjects } = await db
      .from('projects')
      .select('id, name')
      .eq('workspace_id', wsId)
      .in('id', taskProjectIds);
    for (const p of taskProjects || []) {
      projectNameMap.set(p.id, p.name);
    }
  }

  const tasksWithProject = recentTasks
    .filter(t => projectNameMap.has(t.project_id))
    .map(t => ({
      id: t.id,
      project_id: t.project_id,
      title: t.title,
      project_name: projectNameMap.get(t.project_id) || '',
      is_completed: t.is_completed,
      due_date: t.end_date,
      assignee_name: t.assignee_name,
    }));

  // Filter storyboards belonging to this workspace
  const wsStoryboards = (recentStoryboardsRes.data || []).filter(
    (sb: { project_id: string | null }) => sb.project_id && allProjectIds.includes(sb.project_id)
  );

  const recentStoryboards = wsStoryboards.slice(0, 3).map((sb: {
    id: string;
    title: string;
    created_at: string;
    project_id: string;
    current_published_version_id: string | null;
  }) => ({
    id: sb.id,
    title: sb.title,
    created_at: sb.created_at,
    project_id: sb.project_id,
    status: sb.current_published_version_id ? '公開済み' : '下書き',
  }));

  // Budget overview
  let totalBudget = 0;
  let totalSpent = 0;
  if (allProjectIds.length > 0) {
    // Get budget_limit from projects table
    const { data: projectBudgets } = await db
      .from('projects')
      .select('id, budget_limit')
      .in('id', allProjectIds);
    for (const p of projectBudgets || []) {
      totalBudget += p.budget_limit || 0;
    }

    // Also add old budgets table totals
    const { data: budgets } = await db
      .from('budgets')
      .select('id, total_budget')
      .in('project_id', allProjectIds);
    for (const b of budgets || []) {
      totalBudget += b.total_budget || 0;
      const { data: oldItems } = await db
        .from('budget_items')
        .select('amount, quantity')
        .eq('budget_id', b.id);
      for (const item of oldItems || []) {
        totalSpent += (item.amount || 0) * (item.quantity || 1);
      }
    }

    // Add new budget_items (project-level, without budget_id)
    for (const pid of allProjectIds) {
      const { data: newItems } = await db
        .from('budget_items')
        .select('amount')
        .eq('project_id', pid);
      if (newItems) {
        totalSpent += newItems.reduce((s: number, i: { amount: number }) => s + (i.amount || 0), 0);
      }
    }
  }

  // Integration status
  const integrations = (integrationsRes.data || []).map((i: { type: string; enabled: boolean }) => ({
    type: i.type,
    enabled: i.enabled,
  }));

  return jsonResponse({
    active_projects: activeProjects,
    recent_tasks: tasksWithProject,
    stats: {
      total_projects: totalProjectsResult.count || 0,
      active_projects: activeProjectsCountResult.count || 0,
      completed_projects: completedProjectsResult.count || 0,
      total_tasks: 0,
      pending_tasks: 0,
      overdue_tasks: 0,
    },
    counts: {
      video_projects: videoProjectsCountRes.count || 0,
      storyboards: wsStoryboards.length,
      knowledge_items: knowledgeCountRes.count || 0,
      assets: assetsCountRes.count || 0,
    },
    recent_video_projects: (recentVideoProjectsRes.data || []).map((vp: {
      id: string;
      title: string;
      status: string;
      created_at: string;
    }) => ({
      id: vp.id,
      title: vp.title,
      status: vp.status,
      created_at: vp.created_at,
    })),
    recent_storyboards: recentStoryboards,
    recent_ad_analyses: (recentAdAnalysesRes.data || []).map((a: {
      id: string;
      query: string;
      platform: string;
      created_at: string;
    }) => ({
      id: a.id,
      query: a.query,
      platform: a.platform,
      created_at: a.created_at,
    })),
    budget_overview: {
      total_budget: totalBudget,
      total_spent: totalSpent,
      currency: 'JPY',
    },
    integrations,
  });
}

import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceBySlug } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string } }
) {
  const db = getSupabase();
  const workspace = await getWorkspaceBySlug(params.workspaceSlug);
  if (!workspace) return errorResponse('not_found', 'Workspace not found', 404);

  // Get active projects with progress
  const { data: projects } = await db
    .from('projects')
    .select('id, name, status, client_id, created_at')
    .eq('workspace_id', workspace.id)
    .in('status', ['対応中', '進行中'])
    .order('created_at', { ascending: false })
    .limit(5);

  const activeProjects = [];
  for (const p of projects || []) {
    const { count: totalTasks } = await db
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', p.id);

    const { count: completedTasks } = await db
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', p.id)
      .eq('is_completed', true);

    let clientName = null;
    if (p.client_id) {
      const { data: client } = await db
        .from('clients')
        .select('name')
        .eq('id', p.client_id)
        .single();
      clientName = client?.name || null;
    }

    const total = totalTasks || 0;
    const completed = completedTasks || 0;
    activeProjects.push({
      id: p.id,
      name: p.name,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      total_tasks: total,
      completed_tasks: completed,
      client_name: clientName,
      deadline: null,
    });
  }

  // Get recent tasks
  const { data: recentTasks } = await db
    .from('tasks')
    .select('id, project_id, title, is_completed, end_date, assignee_name')
    .order('created_at', { ascending: false })
    .limit(10);

  const tasksWithProject = [];
  for (const t of recentTasks || []) {
    const { data: project } = await db
      .from('projects')
      .select('name, workspace_id')
      .eq('id', t.project_id)
      .eq('workspace_id', workspace.id)
      .single();

    if (project) {
      tasksWithProject.push({
        id: t.id,
        project_id: t.project_id,
        title: t.title,
        project_name: project.name,
        is_completed: t.is_completed,
        due_date: t.end_date,
        assignee_name: t.assignee_name,
      });
    }
  }

  // Stats
  const { count: totalProjects } = await db
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspace.id);

  const { count: activeProjectsCount } = await db
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspace.id)
    .in('status', ['対応中', '進行中']);

  const { count: completedProjects } = await db
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspace.id)
    .eq('status', '完了');

  return jsonResponse({
    active_projects: activeProjects,
    recent_tasks: tasksWithProject,
    stats: {
      total_projects: totalProjects || 0,
      active_projects: activeProjectsCount || 0,
      completed_projects: completedProjects || 0,
      total_tasks: 0,
      pending_tasks: 0,
      overdue_tasks: 0,
    },
  });
}

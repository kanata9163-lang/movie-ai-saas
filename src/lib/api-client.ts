const BASE_URL = '';

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error?.message || 'API Error');
  }
  return json.data as T;
}

// Types
export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  status: string;
  overview: string | null;
  client_id: string | null;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  is_completed: boolean;
  start_date: string | null;
  end_date: string | null;
  assignee_user_id: string | null;
  assignee_name: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  workspace_id: string;
  name: string;
  notes: string | null;
  website_url: string | null;
  industry: string | null;
  contact_person: string | null;
  contact_email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  project_id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  due_date: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  project_id: string;
  currency: string;
  total_budget: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetItem {
  id: string;
  budget_id: string;
  category: string;
  title: string;
  amount: number;
  quantity: number;
  vendor: string | null;
  incurred_on: string | null;
  created_at: string;
  updated_at: string;
}

export interface Storyboard {
  id: string;
  project_id: string;
  title: string;
  current_published_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DraftScene {
  id: string;
  draft_id: string;
  scene_order: number;
  dialogue: string | null;
  description: string | null;
  image_prompt: string | null;
  image_url: string | null;
  image_asset_id: string | null;
  regen_config_override: Record<string, unknown> | null;
}

export interface DraftDetail {
  storyboard: {
    id: string;
    title: string;
    project_id: string | null;
    current_published_version: { id: string; version_number: number } | null;
  };
  draft: {
    id: string;
    generation_config: Record<string, unknown>;
    base_version_id: string | null;
  };
  scenes: DraftScene[];
}

export interface Document {
  id: string;
  project_id: string;
  type: string;
  title: string | null;
  url: string | null;
  memo: string | null;
  asset_id: string | null;
  file_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardData {
  active_projects: Array<{
    id: string;
    name: string;
    progress: number;
    total_tasks: number;
    completed_tasks: number;
    client_name: string | null;
    deadline: string | null;
  }>;
  recent_tasks: Array<{
    id: string;
    project_id: string;
    title: string;
    project_name: string;
    is_completed: boolean;
    due_date: string | null;
    assignee_name: string | null;
  }>;
  stats: {
    total_projects: number;
    active_projects: number;
    completed_projects: number;
    total_tasks: number;
    pending_tasks: number;
    overdue_tasks: number;
  };
}

export interface Job {
  id: string;
  type: string;
  status: string;
  progress: number;
  error_message: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// API Functions
export const api = {
  // Dashboard
  getDashboard: (slug: string) =>
    fetchAPI<DashboardData>(`/api/w/${slug}/dashboard`),

  // Projects
  listProjects: (slug: string, params?: { status?: string; q?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.q) searchParams.set('q', params.q);
    const qs = searchParams.toString();
    return fetchAPI<Project[]>(`/api/w/${slug}/projects${qs ? `?${qs}` : ''}`);
  },
  getProject: (slug: string, projectId: string) =>
    fetchAPI<{ project: Project; summary: Record<string, unknown> }>(`/api/w/${slug}/projects/${projectId}`),
  createProject: (slug: string, data: { name: string; client_id?: string }) =>
    fetchAPI<Project>(`/api/w/${slug}/projects`, { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (slug: string, projectId: string, data: Partial<Project>) =>
    fetchAPI<Project>(`/api/w/${slug}/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProject: (slug: string, projectId: string) =>
    fetchAPI<null>(`/api/w/${slug}/projects/${projectId}`, { method: 'DELETE' }),

  // Tasks
  listTasks: (slug: string, projectId: string) =>
    fetchAPI<Task[]>(`/api/w/${slug}/projects/${projectId}/tasks`),
  createTask: (slug: string, projectId: string, data: { title: string; start_date?: string; end_date?: string }) =>
    fetchAPI<Task>(`/api/w/${slug}/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (slug: string, taskId: string, data: Partial<Task>) =>
    fetchAPI<Task>(`/api/w/${slug}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTask: (slug: string, taskId: string) =>
    fetchAPI<null>(`/api/w/${slug}/tasks/${taskId}`, { method: 'DELETE' }),

  // Clients
  listClients: (slug: string, q?: string) => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    return fetchAPI<Client[]>(`/api/w/${slug}/clients${qs}`);
  },
  createClient: (slug: string, data: { name: string; notes?: string }) =>
    fetchAPI<Client>(`/api/w/${slug}/clients`, { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (slug: string, clientId: string, data: Partial<Client>) =>
    fetchAPI<Client>(`/api/w/${slug}/clients/${clientId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteClient: (slug: string, clientId: string) =>
    fetchAPI<null>(`/api/w/${slug}/clients/${clientId}`, { method: 'DELETE' }),

  // Milestones
  listMilestones: (slug: string, projectId: string) =>
    fetchAPI<Milestone[]>(`/api/w/${slug}/projects/${projectId}/milestones`),
  createMilestone: (slug: string, projectId: string, data: { name: string; start_date?: string; end_date?: string; due_date?: string; status?: string }) =>
    fetchAPI<Milestone>(`/api/w/${slug}/projects/${projectId}/milestones`, { method: 'POST', body: JSON.stringify(data) }),
  updateMilestone: (slug: string, milestoneId: string, data: Partial<Milestone>) =>
    fetchAPI<Milestone>(`/api/w/${slug}/milestones/${milestoneId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMilestone: (slug: string, milestoneId: string) =>
    fetchAPI<null>(`/api/w/${slug}/milestones/${milestoneId}`, { method: 'DELETE' }),

  // Budget
  getBudget: (slug: string, projectId: string) =>
    fetchAPI<Budget | null>(`/api/w/${slug}/projects/${projectId}/budget`),
  createBudget: (slug: string, projectId: string, data: { total_budget?: number; currency?: string }) =>
    fetchAPI<Budget>(`/api/w/${slug}/projects/${projectId}/budget`, { method: 'POST', body: JSON.stringify(data) }),
  updateBudget: (slug: string, budgetId: string, data: Partial<Budget>) =>
    fetchAPI<Budget>(`/api/w/${slug}/budgets/${budgetId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  listBudgetItems: (slug: string, budgetId: string) =>
    fetchAPI<BudgetItem[]>(`/api/w/${slug}/budgets/${budgetId}/items`),
  createBudgetItem: (slug: string, budgetId: string, data: { category: string; title: string; amount: number }) =>
    fetchAPI<BudgetItem>(`/api/w/${slug}/budgets/${budgetId}/items`, { method: 'POST', body: JSON.stringify(data) }),

  // Storyboards
  listAllStoryboards: (slug: string) =>
    fetchAPI<(Storyboard & { project_name: string | null })[]>(`/api/w/${slug}/storyboards`),
  listStoryboards: (slug: string, projectId: string) =>
    fetchAPI<Storyboard[]>(`/api/w/${slug}/projects/${projectId}/storyboards`),
  generateStoryboard: (slug: string, projectId: string, data: Record<string, unknown>) =>
    fetchAPI<{ storyboardId: string; draftId: string; jobId: string }>(`/api/w/${slug}/projects/${projectId}/storyboards/generate`, { method: 'POST', body: JSON.stringify(data) }),
  getDraft: (slug: string, storyboardId: string) =>
    fetchAPI<DraftDetail>(`/api/w/${slug}/storyboards/${storyboardId}/draft`),
  updateDraftScene: (slug: string, sceneId: string, data: Partial<DraftScene>) =>
    fetchAPI<DraftScene>(`/api/w/${slug}/draft-scenes/${sceneId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  generateSceneImage: (slug: string, sceneId: string) =>
    fetchAPI<{ image_url: string }>(`/api/w/${slug}/draft-scenes/${sceneId}/image/generate`, { method: 'POST' }),
  regenerateSceneImage: (slug: string, sceneId: string) =>
    fetchAPI<{ image_url: string }>(`/api/w/${slug}/draft-scenes/${sceneId}/image/regenerate`, { method: 'POST' }),
  publishStoryboard: (slug: string, storyboardId: string) =>
    fetchAPI<{ version_id: string; version_number: number }>(`/api/w/${slug}/storyboards/${storyboardId}/publish`, { method: 'POST' }),
  exportToSheets: (slug: string, storyboardId: string) =>
    fetchAPI<{ spreadsheetId: string; spreadsheetUrl: string }>(`/api/w/${slug}/storyboards/${storyboardId}/export-sheets`, { method: 'POST' }),

  // Documents
  listDocuments: (slug: string, projectId: string) =>
    fetchAPI<Document[]>(`/api/w/${slug}/projects/${projectId}/documents`),
  createDocument: (slug: string, projectId: string, data: { type: string; title?: string; url?: string; memo?: string }) =>
    fetchAPI<Document>(`/api/w/${slug}/projects/${projectId}/documents`, { method: 'POST', body: JSON.stringify(data) }),

  // Jobs
  getJob: (slug: string, jobId: string) =>
    fetchAPI<Job>(`/api/w/${slug}/jobs/${jobId}`),

  // Elements (reference images)
  listElements: (slug: string, projectId: string) =>
    fetchAPI<Array<{ id: string; project_id: string; name: string; label: string; mime_type: string; image_data: string; created_at: string }>>(
      `/api/w/${slug}/projects/${projectId}/elements`
    ),
  createElement: (slug: string, projectId: string, data: { name: string; label?: string; mime_type: string; image_data: string }) =>
    fetchAPI<{ id: string }>(`/api/w/${slug}/projects/${projectId}/elements`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteElement: (slug: string, elementId: string) =>
    fetchAPI<null>(`/api/w/${slug}/elements/${elementId}`, { method: 'DELETE' }),

  // Schedules (all milestones across projects)
  listAllSchedules: (slug: string) =>
    fetchAPI<(Milestone & { project_name: string })[]>(`/api/w/${slug}/schedules`),

  // Workspaces
  listMyWorkspaces: () =>
    fetchAPI<{ items: Array<{ id: string; name: string; slug: string; role: string }> }>('/api/me/workspaces'),

  // Workspace Settings
  getWorkspaceSettings: (slug: string) =>
    fetchAPI<{ workspace: Record<string, unknown>; role: string }>(`/api/w/${slug}/settings`),
  updateWorkspaceSettings: (slug: string, data: { name?: string }) =>
    fetchAPI<Record<string, unknown>>(`/api/w/${slug}/settings`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Members
  listMembers: (slug: string) =>
    fetchAPI<Array<{ id: string; user_id: string; role: string; email: string; display_name: string }>>(`/api/w/${slug}/members`),
  removeMember: (slug: string, memberId: string) =>
    fetchAPI<null>(`/api/w/${slug}/members?memberId=${memberId}`, { method: 'DELETE' }),

  // Invites
  createInvite: (slug: string) =>
    fetchAPI<{ id: string; token: string; expires_at: string }>(`/api/w/${slug}/invites`, { method: 'POST' }),
  listInvites: (slug: string) =>
    fetchAPI<Array<{ id: string; token: string; expires_at: string }>>(`/api/w/${slug}/invites`),
  acceptInvite: (token: string) =>
    fetchAPI<{ workspaceSlug: string; alreadyMember: boolean }>('/api/invites/accept', { method: 'POST', body: JSON.stringify({ token }) }),

  // Auth
  login: (email: string, password: string) =>
    fetchAPI<{ user: unknown; session: unknown }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  signup: (email: string, password: string) =>
    fetchAPI<{ user: unknown; session: unknown }>('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) }),
};

"use client";

import Link from "next/link";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { ChevronRight, Plus, Loader2 } from "lucide-react";
import { api, type DashboardData } from "@/lib/api-client";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";

interface DashboardPageProps {
  params: { workspaceSlug: string };
}

export default function DashboardPage({ params }: DashboardPageProps) {
  const { workspaceSlug } = params;
  const { user } = useUser();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    try {
      const dashboard = await api.getDashboard(workspaceSlug);
      setData(dashboard);
    } catch {
      // Fallback to empty state if API not connected
      setData({
        active_projects: [],
        recent_tasks: [],
        stats: { total_projects: 0, active_projects: 0, completed_projects: 0, total_tasks: 0, pending_tasks: 0, overdue_tasks: 0 },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspaceSlug]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setCreating(true);
    try {
      await api.createProject(workspaceSlug, { name: newProjectName.trim() });
      setNewProjectName("");
      setShowNewProject(false);
      loadData();
    } catch {
      alert("プロジェクト作成に失敗しました");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header title="ダッシュボード" userEmail={user?.email} />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="ダッシュボード" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* In-progress Projects */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">進行中のプロジェクト</h2>
            <Button size="sm" className="gap-1.5" onClick={() => setShowNewProject(true)}>
              <Plus className="w-3.5 h-3.5" />
              新規プロジェクト追加
            </Button>
          </div>

          {showNewProject && (
            <div className="mb-4 rounded-xl border border-border bg-card p-4 flex gap-3">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="プロジェクト名を入力"
                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                autoFocus
              />
              <Button size="sm" onClick={handleCreateProject} disabled={creating}>
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "作成"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowNewProject(false)}>
                キャンセル
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {data?.active_projects.map((project) => (
              <Link
                key={project.id}
                href={`/w/${workspaceSlug}/projects/${project.id}`}
              >
                <div className="rounded-xl border border-border bg-card p-5 hover:shadow-sm transition-shadow cursor-pointer">
                  <h3 className="text-sm font-semibold mb-3">{project.name}</h3>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {project.client_name || "未設定"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      タスク: {project.completed_tasks}/{project.total_tasks}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
            {data?.active_projects.length === 0 && (
              <div className="col-span-3 text-center py-8 text-sm text-muted-foreground">
                進行中のプロジェクトがありません
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Link href={`/w/${workspaceSlug}/projects`}>
              <Button variant="outline" size="sm">
                プロジェクト一覧へ移動
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Recent Tasks */}
        <section>
          <h2 className="text-base font-semibold mb-4">直近のタスク</h2>

          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {(!data?.recent_tasks || data.recent_tasks.length === 0) ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                タスクがありません
              </div>
            ) : (
              data.recent_tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between px-6 py-4"
                >
                  <div>
                    <h3 className="text-sm font-semibold">{task.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{task.project_name}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {task.due_date || ""}
                    </span>
                    <Link href={`/w/${workspaceSlug}/projects/${task.project_id}`}>
                      <Button variant="outline" size="sm">
                        プロジェクト詳細へ
                        <ChevronRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </>
  );
}

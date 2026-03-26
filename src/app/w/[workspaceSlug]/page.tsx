"use client";

import Link from "next/link";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  Plus,
  Loader2,
  Film,
  FileText,
  BookOpen,
  FolderOpen,
  Video,
  PenTool,
  Search,
  Zap,
  MessageSquare,
} from "lucide-react";
import { CardSkeleton, ListSkeleton } from "@/components/Skeleton";
import { api, type DashboardData } from "@/lib/api-client";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";

interface DashboardPageProps {
  params: { workspaceSlug: string };
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    "完了": "bg-green-100 text-green-700",
    "公開済み": "bg-green-100 text-green-700",
    "進行中": "bg-blue-100 text-blue-700",
    "対応中": "bg-blue-100 text-blue-700",
    "下書き": "bg-zinc-100 text-zinc-600",
    "pending": "bg-yellow-100 text-yellow-700",
    "generating": "bg-purple-100 text-purple-700",
  };
  const cls = colorMap[status] || "bg-zinc-100 text-zinc-600";
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {status}
    </span>
  );
}

function DonutChart({ spent, total }: { spent: number; total: number }) {
  const ratio = total > 0 ? Math.min(spent / total, 1) : 0;
  const circumference = 2 * Math.PI * 50;
  const strokeDash = ratio * circumference;
  const isOver = total > 0 && spent > total;

  return (
    <div className="relative w-28 h-28 flex-shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r="50" fill="none" stroke="#f4f4f5" strokeWidth="12" />
        {total > 0 && (
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke={isOver ? "#ef4444" : "#18181b"}
            strokeWidth="12"
            strokeDasharray={`${strokeDash} ${circumference}`}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[9px] text-muted-foreground">
          {total > 0 ? `${Math.round(ratio * 100)}%` : "--"}
        </span>
        <span className="text-[11px] font-semibold">
          {spent > 0 ? `\u00a5${spent.toLocaleString()}` : "\u00a50"}
        </span>
      </div>
    </div>
  );
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
      setData({
        active_projects: [],
        recent_tasks: [],
        stats: { total_projects: 0, active_projects: 0, completed_projects: 0, total_tasks: 0, pending_tasks: 0, overdue_tasks: 0 },
        counts: { video_projects: 0, storyboards: 0, knowledge_items: 0, assets: 0 },
        recent_video_projects: [],
        recent_storyboards: [],
        recent_ad_analyses: [],
        budget_overview: { total_budget: 0, total_spent: 0, currency: "JPY" },
        integrations: [],
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
        <main className="flex-1 overflow-y-auto p-6 space-y-8">
          <section>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-zinc-200 rounded-xl animate-pulse" />
              ))}
            </div>
          </section>
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="h-5 w-40 bg-zinc-200 rounded animate-pulse" />
              <div className="h-8 w-40 bg-zinc-200 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          </section>
          <section>
            <div className="h-5 w-32 bg-zinc-200 rounded animate-pulse mb-4" />
            <ListSkeleton rows={5} />
          </section>
        </main>
      </>
    );
  }

  const counts = data?.counts || { video_projects: 0, storyboards: 0, knowledge_items: 0, assets: 0 };
  const budget = data?.budget_overview || { total_budget: 0, total_spent: 0, currency: "JPY" };
  const integrations = data?.integrations || [];

  const slackIntegration = integrations.find((i) => i.type === "slack");
  const lineIntegration = integrations.find((i) => i.type === "line");

  return (
    <>
      <Header title="ダッシュボード" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Quick Stats Row */}
        <section>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Film className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.video_projects}</p>
                <p className="text-xs text-muted-foreground">動画プロジェクト数</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.storyboards}</p>
                <p className="text-xs text-muted-foreground">絵コンテ数</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.knowledge_items}</p>
                <p className="text-xs text-muted-foreground">ナレッジ数</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.assets}</p>
                <p className="text-xs text-muted-foreground">ファイル数</p>
              </div>
            </div>
          </div>
        </section>

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
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
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
              <Link key={project.id} href={`/w/${workspaceSlug}/projects/${project.id}`}>
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

        {/* Budget Overview & Integration Status - side by side */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Budget Overview */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold mb-4">予算状況</h2>
            <div className="flex items-center gap-6">
              <DonutChart spent={budget.total_spent} total={budget.total_budget} />
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">支出合計</p>
                  <p className="text-lg font-semibold">{"\u00a5"}{budget.total_spent.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">予算合計</p>
                  <p className="text-sm text-muted-foreground">{"\u00a5"}{budget.total_budget.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/w/${workspaceSlug}/projects`}>
                    <Button variant="outline" size="sm" className="text-xs">
                      詳細
                      <ChevronRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Integration Status */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">連携状況</h2>
              <Link href={`/w/${workspaceSlug}/settings`}>
                <Button variant="outline" size="sm" className="text-xs">
                  設定
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#4A154B]/10 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-[#4A154B]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Slack</p>
                    <p className="text-xs text-muted-foreground">Webhook通知</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  slackIntegration?.enabled
                    ? "bg-green-100 text-green-700"
                    : "bg-zinc-100 text-zinc-500"
                }`}>
                  {slackIntegration?.enabled ? "接続済み" : "未接続"}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#00B900]/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-[#00B900]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">LINE Notify</p>
                    <p className="text-xs text-muted-foreground">通知連携</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  lineIntegration?.enabled
                    ? "bg-green-100 text-green-700"
                    : "bg-zinc-100 text-zinc-500"
                }`}>
                  {lineIntegration?.enabled ? "接続済み" : "未接続"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Activity */}
        <section>
          <h2 className="text-base font-semibold mb-4">最近のアクティビティ</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Recent Video Projects */}
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <Video className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-medium">動画プロジェクト</h3>
              </div>
              {(data?.recent_video_projects || []).length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  まだありません
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {(data?.recent_video_projects || []).map((vp) => (
                    <Link key={vp.id} href={`/w/${workspaceSlug}/video/${vp.id}`}>
                      <div className="px-4 py-3 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-medium truncate flex-1 mr-2">{vp.title}</h4>
                          <StatusBadge status={vp.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDate(vp.created_at)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Storyboards */}
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <PenTool className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-medium">絵コンテ</h3>
              </div>
              {(data?.recent_storyboards || []).length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  まだありません
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {(data?.recent_storyboards || []).map((sb) => (
                    <Link key={sb.id} href={`/w/${workspaceSlug}/storyboards/${sb.id}`}>
                      <div className="px-4 py-3 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-medium truncate flex-1 mr-2">{sb.title}</h4>
                          <StatusBadge status={sb.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDate(sb.created_at)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Ad Analyses */}
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <Search className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-medium">広告リサーチ</h3>
              </div>
              {(data?.recent_ad_analyses || []).length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  まだありません
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {(data?.recent_ad_analyses || []).map((a) => (
                    <Link key={a.id} href={`/w/${workspaceSlug}/ad-research`}>
                      <div className="px-4 py-3 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-medium truncate flex-1 mr-2">{a.query}</h4>
                          <StatusBadge status={a.platform} />
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDate(a.created_at)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
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

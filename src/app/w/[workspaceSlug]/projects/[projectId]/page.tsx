"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  api,
  type Project,
  type Task,
  type Milestone,
  type Budget,
  type BudgetItem,
  type Storyboard,
} from "@/lib/api-client";
import {
  Plus,
  Loader2,
  Check,
  Clock,
  Grid3X3,
  ChevronLeft,
  ChevronRight,
  X,
  Wand2,
  Video,
  Megaphone,
  TrendingUp,
  BookOpen,
} from "lucide-react";
import LoadingAnimation from "@/components/LoadingAnimation";
import Link from "next/link";
import { useUser } from "@/lib/useUser";

interface ProjectDetailPageProps {
  params: { workspaceSlug: string; projectId: string };
}

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { workspaceSlug, projectId } = params;
  const { user } = useUser();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskStartDate, setNewTaskStartDate] = useState("");
  const [newTaskEndDate, setNewTaskEndDate] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  // Milestones (schedules)
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState("");
  const [newMilestoneStartDate, setNewMilestoneStartDate] = useState("");
  const [newMilestoneEndDate, setNewMilestoneEndDate] = useState("");
  const [newMilestoneStatus, setNewMilestoneStatus] = useState("予定");
  const [addAlsoAsTask, setAddAlsoAsTask] = useState(false);
  const [addingMilestone, setAddingMilestone] = useState(false);

  // Budget
  const [budget, setBudget] = useState<Budget | null>(null);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);

  // Storyboard
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);

  // Linked resources
  interface LinkedResources {
    adAnalyses: Array<{ id: string; query: string; platform: string; created_at: string }>;
    trendReports: Array<{ id: string; topic: string; platform: string; created_at: string }>;
    knowledgeItems: Array<{ id: string; title: string; type: string; created_at: string }>;
    videoProjects: Array<{ id: string; title: string; status: string; created_at: string }>;
  }
  const [linkedResources, setLinkedResources] = useState<LinkedResources | null>(null);

  useEffect(() => {
    loadAll();
  }, [workspaceSlug, projectId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [projectData] = await Promise.all([
        api.getProject(workspaceSlug, projectId),
      ]);
      setProject(projectData.project);
    } catch {
      setProject(null);
    } finally {
      setLoading(false);
    }

    Promise.all([
      loadTasks(),
      loadMilestones(),
      loadBudget(),
      loadStoryboards(),
      loadLinkedResources(),
    ]).catch(() => {});
  };

  const loadTasks = async () => {
    try {
      const data = await api.listTasks(workspaceSlug, projectId);
      setTasks(data);
    } catch {
      setTasks([]);
    }
  };

  const loadMilestones = async () => {
    try {
      const data = await api.listMilestones(workspaceSlug, projectId);
      setMilestones(data);
    } catch {
      setMilestones([]);
    }
  };

  const loadBudget = async () => {
    try {
      const data = await api.getBudget(workspaceSlug, projectId);
      setBudget(data);
      if (data?.id) {
        const items = await api.listBudgetItems(workspaceSlug, data.id);
        setBudgetItems(items);
      }
    } catch {
      setBudget(null);
    }
  };

  const loadStoryboards = async () => {
    try {
      const data = await api.listStoryboards(workspaceSlug, projectId);
      setStoryboards(data);
    } catch {
      setStoryboards([]);
    }
  };

  const loadLinkedResources = async () => {
    try {
      const res = await fetch(`/api/w/${workspaceSlug}/projects/${projectId}/linked-resources`);
      const json = await res.json();
      if (json.ok) setLinkedResources(json.data);
    } catch {
      // ignore
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);
    try {
      await api.createTask(workspaceSlug, projectId, {
        title: newTaskTitle.trim(),
        start_date: newTaskStartDate || undefined,
        end_date: newTaskEndDate || undefined,
      });
      setNewTaskTitle("");
      setNewTaskStartDate("");
      setNewTaskEndDate("");
      setNewTaskAssignee("");
      setShowTaskModal(false);
      loadTasks();
    } catch {
      alert("タスク作成に失敗しました");
    } finally {
      setAddingTask(false);
    }
  };

  const handleAddMilestone = async () => {
    if (!newMilestoneName.trim()) return;
    setAddingMilestone(true);
    try {
      await api.createMilestone(workspaceSlug, projectId, {
        name: newMilestoneName.trim(),
        start_date: newMilestoneStartDate || undefined,
        end_date: newMilestoneEndDate || undefined,
        due_date: newMilestoneEndDate || undefined,
        status: newMilestoneStatus || undefined,
      });
      if (addAlsoAsTask) {
        await api.createTask(workspaceSlug, projectId, {
          title: newMilestoneName.trim(),
          start_date: newMilestoneStartDate || undefined,
          end_date: newMilestoneEndDate || undefined,
        });
        loadTasks();
      }
      setNewMilestoneName("");
      setNewMilestoneStartDate("");
      setNewMilestoneEndDate("");
      setNewMilestoneStatus("予定");
      setAddAlsoAsTask(false);
      setShowScheduleModal(false);
      loadMilestones();
    } catch {
      alert("スケジュール作成に失敗しました");
    } finally {
      setAddingMilestone(false);
    }
  };

  const handleToggleTask = async (task: Task) => {
    try {
      await api.updateTask(workspaceSlug, task.id, {
        is_completed: !task.is_completed,
      });
      loadTasks();
    } catch {
      // silently fail
    }
  };

  // Budget calculations
  const totalSpent = budgetItems.reduce(
    (sum, item) => sum + item.amount * item.quantity,
    0
  );
  const totalBudget = budget?.total_budget || 0;
  const budgetPercent =
    totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;

  // Task progress
  const completedTasks = tasks.filter((t) => t.is_completed).length;
  const taskProgress =
    tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const formatShortDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const y = d.getFullYear().toString().slice(2);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}.${m}.${day}`;
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "進行中":
      case "対応中":
        return "blue" as const;
      case "完了":
        return "green" as const;
      case "保留":
        return "yellow" as const;
      default:
        return "default" as const;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "planned":
        return "予定";
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <>
        <Header title="プロジェクト詳細" userEmail={user?.email} />
        <main className="flex-1 flex items-center justify-center">
          <LoadingAnimation message="プロジェクトを読み込み中..." />
        </main>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <Header title="プロジェクト詳細" userEmail={user?.email} />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">プロジェクトが見つかりません</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title={project.name} userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto p-6">
        {/* Back link */}
        <Link
          href={`/w/${workspaceSlug}/projects`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          プロジェクト一覧
        </Link>

        {/* Project title */}
        <h1 className="text-xl font-bold mb-6">{project.name}</h1>

        {/* Main layout: content + right sidebar */}
        <div className="flex gap-6">
          {/* Left content area */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Progress section */}
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">
                  プロジェクトの進捗度
                </h2>
                <span className="text-xs text-muted-foreground">
                  {completedTasks}/{tasks.length} タスク完了
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-900 rounded-full transition-all"
                    style={{ width: `${taskProgress}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {taskProgress}%
                </span>
              </div>
            </section>

            {/* Project documents section */}
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">
                  プロジェクト資料
                </h2>
                <Link
                  href={`/w/${workspaceSlug}/projects/${projectId}/documents`}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <BookOpen className="w-3 h-3" />
                  資料一覧を開く
                </Link>
              </div>
              <Link
                href={`/w/${workspaceSlug}/projects/${projectId}/documents`}
                className="block py-4 text-center text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-zinc-50"
              >
                資料一覧ページで資料を管理 →
              </Link>
            </section>

            {/* Schedule section */}
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">
                  スケジュール
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {milestones.length}件
                  </span>
                </h2>
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  新規追加
                </button>
              </div>
              {milestones.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-center">
                  <Clock className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">
                    まだスケジュールがありません
                  </p>
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="text-sm text-foreground hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    スケジュールを作成
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {milestones.map((ms) => (
                    <div
                      key={ms.id}
                      className="py-3 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{ms.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={statusColor(ms.status)} className="text-[10px]">
                            {statusLabel(ms.status)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {ms.start_date && ms.end_date
                              ? `${formatShortDate(ms.start_date)} ~ ${formatShortDate(ms.end_date)}`
                              : ms.start_date
                              ? `${formatShortDate(ms.start_date)} ~`
                              : ms.end_date
                              ? `~ ${formatShortDate(ms.end_date)}`
                              : ms.due_date
                              ? `期限: ${formatShortDate(ms.due_date)}`
                              : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Tasks section */}
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">
                  タスク表
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {tasks.length}件
                  </span>
                </h2>
                <button
                  onClick={() => setShowTaskModal(true)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  新規追加
                </button>
              </div>
              {tasks.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-center">
                  <Check className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">
                    まだタスクがありません
                  </p>
                  <button
                    onClick={() => setShowTaskModal(true)}
                    className="text-sm text-foreground hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    タスクを作成
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="py-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleToggleTask(task)}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            task.is_completed
                              ? "bg-zinc-900 border-zinc-900 text-white"
                              : "border-zinc-300 hover:border-zinc-400"
                          }`}
                        >
                          {task.is_completed && <Check className="w-3 h-3" />}
                        </button>
                        <span
                          className={`text-sm ${
                            task.is_completed
                              ? "line-through text-muted-foreground"
                              : ""
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {task.assignee_name && <span>{task.assignee_name}</span>}
                        {task.end_date && (
                          <span>{formatShortDate(task.end_date)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Storyboard section */}
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">
                  絵コンテ
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {storyboards.length}件
                  </span>
                </h2>
                <Link
                  href={`/w/${workspaceSlug}/projects/${projectId}/storyboard/new`}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  絵コンテを作成
                </Link>
              </div>

              {storyboards.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-center">
                  <Grid3X3 className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">
                    まだ絵コンテがありません
                  </p>
                  <Link
                    href={`/w/${workspaceSlug}/projects/${projectId}/storyboard/new`}
                    className="text-sm text-foreground hover:underline flex items-center gap-1"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    AIで絵コンテを作成
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {storyboards.map((sb) => (
                    <div
                      key={sb.id}
                      className="rounded-lg border border-border bg-white p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-medium truncate">
                              {sb.title}
                            </h3>
                            <Badge
                              variant={
                                sb.current_published_version_id
                                  ? "green"
                                  : "default"
                              }
                              className="text-[10px] flex-shrink-0"
                            >
                              {sb.current_published_version_id
                                ? "公開済み"
                                : "ドラフト"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            更新日:{" "}
                            {new Date(sb.updated_at).toLocaleDateString("ja-JP")}
                          </p>
                        </div>
                        <Link
                          href={`/w/${workspaceSlug}/storyboards/${sb.id}`}
                        >
                          <Button variant="ghost" size="sm" className="text-xs">
                            編集
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Linked Resources */}
            {linkedResources && (
              <>
                {/* Video Projects */}
                {linkedResources.videoProjects.length > 0 && (
                  <section className="rounded-xl border border-border bg-card p-5">
                    <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Video className="w-4 h-4 text-zinc-500" />
                      動画プロジェクト
                      <span className="text-xs font-normal text-muted-foreground">
                        {linkedResources.videoProjects.length}件
                      </span>
                    </h2>
                    <div className="space-y-2">
                      {linkedResources.videoProjects.map((vp) => (
                        <Link
                          key={vp.id}
                          href={`/w/${workspaceSlug}/video/${vp.id}`}
                          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-50 transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium">{vp.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(vp.created_at).toLocaleDateString("ja-JP")}
                            </p>
                          </div>
                          <Badge variant={vp.status === 'completed' ? 'green' : 'default'} className="text-[10px]">
                            {vp.status === 'completed' ? '完了' : vp.status}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {/* Ad Analyses */}
                {linkedResources.adAnalyses.length > 0 && (
                  <section className="rounded-xl border border-border bg-card p-5">
                    <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-zinc-500" />
                      広告分析
                      <span className="text-xs font-normal text-muted-foreground">
                        {linkedResources.adAnalyses.length}件
                      </span>
                    </h2>
                    <div className="space-y-2">
                      {linkedResources.adAnalyses.map((ad) => (
                        <Link
                          key={ad.id}
                          href={`/w/${workspaceSlug}/ad-research`}
                          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-50 transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium">{ad.query}</p>
                            <p className="text-xs text-muted-foreground">
                              {ad.platform} - {new Date(ad.created_at).toLocaleDateString("ja-JP")}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-zinc-400" />
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {/* Trend Reports */}
                {linkedResources.trendReports.length > 0 && (
                  <section className="rounded-xl border border-border bg-card p-5">
                    <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-zinc-500" />
                      トレンドリサーチ
                      <span className="text-xs font-normal text-muted-foreground">
                        {linkedResources.trendReports.length}件
                      </span>
                    </h2>
                    <div className="space-y-2">
                      {linkedResources.trendReports.map((tr) => (
                        <Link
                          key={tr.id}
                          href={`/w/${workspaceSlug}/trends`}
                          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-50 transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium">{tr.topic}</p>
                            <p className="text-xs text-muted-foreground">
                              {tr.platform} - {new Date(tr.created_at).toLocaleDateString("ja-JP")}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-zinc-400" />
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {/* Knowledge Items */}
                {linkedResources.knowledgeItems.length > 0 && (
                  <section className="rounded-xl border border-border bg-card p-5">
                    <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-zinc-500" />
                      ナレッジ
                      <span className="text-xs font-normal text-muted-foreground">
                        {linkedResources.knowledgeItems.length}件
                      </span>
                    </h2>
                    <div className="space-y-2">
                      {linkedResources.knowledgeItems.map((ki) => (
                        <Link
                          key={ki.id}
                          href={`/w/${workspaceSlug}/knowledge`}
                          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-50 transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium">{ki.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {ki.type} - {new Date(ki.created_at).toLocaleDateString("ja-JP")}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-zinc-400" />
                        </Link>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>

          {/* Right sidebar */}
          <div className="w-72 flex-shrink-0 hidden lg:block space-y-6">
            {/* Budget card */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">
                  予算状況
                </h2>
                <Link
                  href={`/w/${workspaceSlug}/projects/${projectId}/budget`}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                >
                  詳細
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              {/* Donut chart */}
              <div className="flex justify-center mb-4">
                <div className="relative w-36 h-36">
                  <svg
                    viewBox="0 0 120 120"
                    className="w-full h-full -rotate-90"
                  >
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke="#f4f4f5"
                      strokeWidth="12"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke="#18181b"
                      strokeWidth="12"
                      strokeDasharray={`${
                        (budgetPercent / 100) * 314.16
                      } 314.16`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-muted-foreground">
                      Total
                    </span>
                    <span className="text-xs font-semibold">
                      ¥{totalSpent.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      / ¥{totalBudget.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <Link href={`/w/${workspaceSlug}/projects/${projectId}/budget`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  新規入力
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setShowScheduleModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 z-50">
            <button
              onClick={() => setShowScheduleModal(false)}
              className="absolute top-4 right-4 p-1 rounded hover:bg-zinc-100 text-zinc-400"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-semibold mb-1">新規スケジュール</h2>
            <p className="text-sm text-muted-foreground mb-5">
              新しいスケジュールを作成します
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  スケジュール名
                </label>
                <Input
                  value={newMilestoneName}
                  onChange={(e) => setNewMilestoneName(e.target.value)}
                  placeholder="スケジュール名を入力"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  開始日（任意）
                </label>
                <Input
                  type="date"
                  value={newMilestoneStartDate}
                  onChange={(e) => setNewMilestoneStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  終了日（任意）
                </label>
                <Input
                  type="date"
                  value={newMilestoneEndDate}
                  onChange={(e) => setNewMilestoneEndDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  ステータス
                </label>
                <select
                  value={newMilestoneStatus}
                  onChange={(e) => setNewMilestoneStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
                >
                  <option value="予定">予定</option>
                  <option value="進行中">進行中</option>
                  <option value="完了">完了</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={addAlsoAsTask}
                  onChange={(e) => setAddAlsoAsTask(e.target.checked)}
                  className="rounded border-border"
                />
                同じ内容をタスクにも追加する
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowScheduleModal(false)}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleAddMilestone}
                disabled={addingMilestone || !newMilestoneName.trim()}
              >
                {addingMilestone && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                作成
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setShowTaskModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 z-50">
            <button
              onClick={() => setShowTaskModal(false)}
              className="absolute top-4 right-4 p-1 rounded hover:bg-zinc-100 text-zinc-400"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-semibold mb-1">新規タスク</h2>
            <p className="text-sm text-muted-foreground mb-5">
              新しいタスクを作成します
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  タスク名
                </label>
                <Input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="タスク名を入力"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  開始日（任意）
                </label>
                <Input
                  type="date"
                  value={newTaskStartDate}
                  onChange={(e) => setNewTaskStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  終了日（任意）
                </label>
                <Input
                  type="date"
                  value={newTaskEndDate}
                  onChange={(e) => setNewTaskEndDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  担当者（任意）
                </label>
                <select
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
                >
                  <option value="">未割り当て</option>
                  {user?.email && (
                    <option value={user.email}>{user.email}</option>
                  )}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowTaskModal(false)}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleAddTask}
                disabled={addingTask || !newTaskTitle.trim()}
              >
                {addingTask && <Loader2 className="w-4 h-4 animate-spin" />}
                作成
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

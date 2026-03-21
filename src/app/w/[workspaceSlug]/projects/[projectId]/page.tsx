"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
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
  type DraftDetail,
} from "@/lib/api-client";
import {
  Plus,
  Loader2,
  Check,
  Clock,
  Grid3X3,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Wand2,
  RefreshCw,
  X,
} from "lucide-react";
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
  const [draftDetail, setDraftDetail] = useState<DraftDetail | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);

  // Storyboard generation form
  const [showGenForm, setShowGenForm] = useState(false);
  const [genTitle, setGenTitle] = useState("");
  const [genBrief, setGenBrief] = useState("");
  const [genPanelCount, setGenPanelCount] = useState(6);
  const [genDuration, setGenDuration] = useState(30);

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

    // Load all data in parallel
    Promise.all([
      loadTasks(),
      loadMilestones(),
      loadBudget(),
      loadStoryboards(),
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
      if (data.length > 0) {
        const draft = await api.getDraft(workspaceSlug, data[0].id);
        setDraftDetail(draft);
      }
    } catch {
      setStoryboards([]);
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
        due_date: newMilestoneEndDate || undefined,
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

  const handleGenerate = async () => {
    if (!genTitle.trim()) return;
    setGenerating(true);
    try {
      const result = await api.generateStoryboard(workspaceSlug, projectId, {
        title: genTitle,
        brief: genBrief || undefined,
        config: {
          duration_sec: genDuration,
          panel_count: genPanelCount,
          with_images: false,
          text_density: "normal",
          dialogue_density: "normal",
        },
      });
      setShowGenForm(false);
      await loadStoryboards();
      try {
        const draft = await api.getDraft(workspaceSlug, result.storyboardId);
        setDraftDetail(draft);
      } catch {}
    } catch (e) {
      alert(`絵コンテ生成に失敗しました: ${e instanceof Error ? e.message : ""}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateImage = async (sceneId: string) => {
    setGeneratingImageId(sceneId);
    try {
      const result = await api.generateSceneImage(workspaceSlug, sceneId);
      if (draftDetail) {
        setDraftDetail({
          ...draftDetail,
          scenes: draftDetail.scenes.map((s) =>
            s.id === sceneId ? { ...s, image_url: result.image_url } : s
          ),
        });
      }
    } catch (e) {
      alert(`画像生成に失敗しました: ${e instanceof Error ? e.message : ""}`);
    } finally {
      setGeneratingImageId(null);
    }
  };

  const handleRegenerateImage = async (sceneId: string) => {
    setGeneratingImageId(sceneId);
    try {
      const result = await api.regenerateSceneImage(workspaceSlug, sceneId);
      if (draftDetail) {
        setDraftDetail({
          ...draftDetail,
          scenes: draftDetail.scenes.map((s) =>
            s.id === sceneId ? { ...s, image_url: result.image_url } : s
          ),
        });
      }
    } catch (e) {
      alert(`画像再生成に失敗しました: ${e instanceof Error ? e.message : ""}`);
    } finally {
      setGeneratingImageId(null);
    }
  };

  // Budget calculations
  const totalSpent = budgetItems.reduce((sum, item) => sum + item.amount * item.quantity, 0);
  const totalBudget = budget?.total_budget || 0;
  const budgetPercent = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;

  // Task progress
  const completedTasks = tasks.filter((t) => t.is_completed).length;
  const taskProgress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  if (loading) {
    return (
      <>
        <Header title="プロジェクト詳細" userEmail={user?.email} />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
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
                <h2 className="text-sm font-semibold text-foreground">プロジェクトの進捗度</h2>
                <Link
                  href={`/w/${workspaceSlug}/projects/${projectId}`}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                >
                  タスク一覧に移動
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-900 rounded-full transition-all"
                    style={{ width: `${taskProgress}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-foreground">{taskProgress}%</span>
              </div>
            </section>

            {/* Project documents section */}
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">プロジェクト資料</h2>
              <div className="py-4 text-center text-sm text-muted-foreground">
                資料はまだありません
              </div>
            </section>

            {/* Schedule section */}
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">
                  スケジュール
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{milestones.length}件</span>
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
                  <p className="text-sm text-muted-foreground mb-3">まだスケジュールがありません</p>
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
                    <div key={ms.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{ms.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">{ms.status}</span>
                          {ms.due_date && (
                            <span className="text-xs text-muted-foreground">期限: {ms.due_date}</span>
                          )}
                          {ms.start_date && (
                            <span className="text-xs text-muted-foreground">開始: {ms.start_date}</span>
                          )}
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
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{tasks.length}件</span>
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
                  <p className="text-sm text-muted-foreground mb-3">まだタスクがありません</p>
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
                    <div key={task.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            task.is_completed
                              ? "bg-zinc-900 border-zinc-900 text-white"
                              : "border-zinc-300"
                          }`}
                        >
                          {task.is_completed && <Check className="w-3 h-3" />}
                        </div>
                        <span
                          className={`text-sm ${
                            task.is_completed ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {task.assignee_name && <span>{task.assignee_name}</span>}
                        {task.end_date && <span>{task.end_date}</span>}
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
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{storyboards.length}件</span>
                </h2>
                <button
                  onClick={() => setShowGenForm(true)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  絵コンテを作成
                </button>
              </div>

              {storyboards.length === 0 && !showGenForm ? (
                <div className="py-8 flex flex-col items-center justify-center text-center">
                  <Grid3X3 className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">まだ絵コンテがありません</p>
                  <button
                    onClick={() => setShowGenForm(true)}
                    className="text-sm text-foreground hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    AIで絵コンテを作成
                  </button>
                </div>
              ) : null}

              {showGenForm && (
                <div className="rounded-lg border border-border bg-zinc-50 p-5 space-y-4 mb-4">
                  <h3 className="text-sm font-semibold">絵コンテ生成設定</h3>
                  <div className="grid gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">タイトル *</label>
                      <Input
                        value={genTitle}
                        onChange={(e) => setGenTitle(e.target.value)}
                        placeholder="絵コンテのタイトル"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">概要・ブリーフ</label>
                      <textarea
                        value={genBrief}
                        onChange={(e) => setGenBrief(e.target.value)}
                        placeholder="映像の概要やブリーフを入力..."
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background min-h-[100px]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">コマ数</label>
                        <Input
                          type="number"
                          value={genPanelCount}
                          onChange={(e) => setGenPanelCount(parseInt(e.target.value))}
                          min={1}
                          max={30}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">尺（秒）</label>
                        <Input
                          type="number"
                          value={genDuration}
                          onChange={(e) => setGenDuration(parseInt(e.target.value))}
                          min={5}
                          max={600}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleGenerate} disabled={generating || !genTitle.trim()}>
                      {generating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Wand2 className="w-4 h-4" />
                      )}
                      {generating ? "生成中..." : "生成開始"}
                    </Button>
                    <Button variant="outline" onClick={() => setShowGenForm(false)}>
                      キャンセル
                    </Button>
                  </div>
                </div>
              )}

              {draftDetail && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{draftDetail.storyboard.title}</h3>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setShowGenForm(true)}>
                        <Plus className="w-3.5 h-3.5" /> 新規生成
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            await api.publishStoryboard(workspaceSlug, draftDetail.storyboard.id);
                            alert("絵コンテを公開しました");
                            loadStoryboards();
                          } catch {
                            alert("公開に失敗しました");
                          }
                        }}
                      >
                        公開
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {draftDetail.scenes.map((scene) => (
                      <div key={scene.id} className="rounded-lg border border-border bg-white overflow-hidden">
                        <div className="aspect-video bg-zinc-100 flex items-center justify-center relative">
                          {scene.image_url ? (
                            <img
                              src={scene.image_url}
                              alt={`Scene ${scene.scene_order}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-8 h-8 text-muted-foreground" />
                          )}
                          {generatingImageId === scene.id && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <Loader2 className="w-6 h-6 animate-spin text-white" />
                            </div>
                          )}
                        </div>
                        <div className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground">
                              #{scene.scene_order}
                            </span>
                            <div className="flex gap-1">
                              {scene.image_url ? (
                                <button
                                  onClick={() => handleRegenerateImage(scene.id)}
                                  disabled={generatingImageId === scene.id}
                                  className="p-1.5 rounded hover:bg-zinc-100 text-muted-foreground transition-colors"
                                  title="画像を再生成"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleGenerateImage(scene.id)}
                                  disabled={generatingImageId === scene.id || !scene.image_prompt}
                                  className="p-1.5 rounded hover:bg-zinc-100 text-muted-foreground transition-colors"
                                  title="画像を生成"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          {scene.dialogue && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">セリフ</p>
                              <p className="text-sm">{scene.dialogue}</p>
                            </div>
                          )}
                          {scene.description && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">説明</p>
                              <p className="text-sm text-muted-foreground">{scene.description}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {storyboards.length > 0 && !draftDetail && (
                <div className="divide-y divide-border">
                  {storyboards.map((sb) => (
                    <div key={sb.id} className="py-3 flex justify-between items-center">
                      <span className="text-sm font-medium">{sb.title}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const draft = await api.getDraft(workspaceSlug, sb.id);
                          setDraftDetail(draft);
                        }}
                      >
                        表示
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right sidebar */}
          <div className="w-72 flex-shrink-0 hidden lg:block space-y-6">
            {/* Budget card */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">予算状況</h2>
                <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                  詳細
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {/* Donut chart */}
              <div className="flex justify-center mb-4">
                <div className="relative w-36 h-36">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
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
                      strokeDasharray={`${(budgetPercent / 100) * 314.16} 314.16`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-muted-foreground">Total</span>
                    <span className="text-xs font-semibold">
                      ¥{totalSpent.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      / ¥{totalBudget.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={async () => {
                  if (!budget) {
                    await api.createBudget(workspaceSlug, projectId, { total_budget: 0 });
                    loadBudget();
                  }
                }}
              >
                新規入力
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowScheduleModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 z-50">
            <button
              onClick={() => setShowScheduleModal(false)}
              className="absolute top-4 right-4 p-1 rounded hover:bg-zinc-100 text-zinc-400"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-semibold mb-1">新規スケジュール</h2>
            <p className="text-sm text-muted-foreground mb-5">新しいスケジュールを作成します</p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">スケジュール名</label>
                <Input
                  value={newMilestoneName}
                  onChange={(e) => setNewMilestoneName(e.target.value)}
                  placeholder="スケジュール名を入力"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">開始日（任意）</label>
                <Input
                  type="date"
                  value={newMilestoneStartDate}
                  onChange={(e) => setNewMilestoneStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">終了日（任意）</label>
                <Input
                  type="date"
                  value={newMilestoneEndDate}
                  onChange={(e) => setNewMilestoneEndDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">ステータス</label>
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
              <Button variant="outline" onClick={() => setShowScheduleModal(false)}>
                キャンセル
              </Button>
              <Button onClick={handleAddMilestone} disabled={addingMilestone || !newMilestoneName.trim()}>
                {addingMilestone && <Loader2 className="w-4 h-4 animate-spin" />}
                作成
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowTaskModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 z-50">
            <button
              onClick={() => setShowTaskModal(false)}
              className="absolute top-4 right-4 p-1 rounded hover:bg-zinc-100 text-zinc-400"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-semibold mb-1">新規タスク</h2>
            <p className="text-sm text-muted-foreground mb-5">新しいタスクを作成します</p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">タスク名</label>
                <Input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="タスク名を入力"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">開始日（任意）</label>
                <Input
                  type="date"
                  value={newTaskStartDate}
                  onChange={(e) => setNewTaskStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">終了日（任意）</label>
                <Input
                  type="date"
                  value={newTaskEndDate}
                  onChange={(e) => setNewTaskEndDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">担当者（任意）</label>
                <select
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
                >
                  <option value="">未割り当て</option>
                  {user?.email && <option value={user.email}>{user.email}</option>}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowTaskModal(false)}>
                キャンセル
              </Button>
              <Button onClick={handleAddTask} disabled={addingTask || !newTaskTitle.trim()}>
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

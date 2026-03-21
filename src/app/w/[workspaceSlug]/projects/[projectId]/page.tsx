"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Trash2,
  RefreshCw,
  ImageIcon,
  Wand2,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { useUser } from "@/lib/useUser";

interface ProjectDetailPageProps {
  params: { workspaceSlug: string; projectId: string };
}

type TabType = "overview" | "tasks" | "schedule" | "budget" | "storyboard";

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { workspaceSlug, projectId } = params;
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  // Milestones
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [newMilestoneName, setNewMilestoneName] = useState("");
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
    loadProject();
  }, [workspaceSlug, projectId]);

  useEffect(() => {
    if (activeTab === "tasks") loadTasks();
    if (activeTab === "schedule") loadMilestones();
    if (activeTab === "budget") loadBudget();
    if (activeTab === "storyboard") loadStoryboards();
  }, [activeTab]);

  const loadProject = async () => {
    try {
      const data = await api.getProject(workspaceSlug, projectId);
      setProject(data.project);
    } catch {
      setProject(null);
    } finally {
      setLoading(false);
    }
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
      await api.createTask(workspaceSlug, projectId, { title: newTaskTitle.trim() });
      setNewTaskTitle("");
      loadTasks();
    } catch {
      alert("タスク作成に失敗しました");
    } finally {
      setAddingTask(false);
    }
  };

  const handleToggleTask = async (task: Task) => {
    try {
      await api.updateTask(workspaceSlug, task.id, { is_completed: !task.is_completed });
      loadTasks();
    } catch {
      alert("更新に失敗しました");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await api.deleteTask(workspaceSlug, taskId);
      loadTasks();
    } catch {
      alert("削除に失敗しました");
    }
  };

  const handleAddMilestone = async () => {
    if (!newMilestoneName.trim()) return;
    setAddingMilestone(true);
    try {
      await api.createMilestone(workspaceSlug, projectId, { name: newMilestoneName.trim() });
      setNewMilestoneName("");
      loadMilestones();
    } catch {
      alert("マイルストーン作成に失敗しました");
    } finally {
      setAddingMilestone(false);
    }
  };

  const handleGenerate = async () => {
    if (!genTitle.trim()) return;
    setGenerating(true);
    try {
      await api.generateStoryboard(workspaceSlug, projectId, {
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
      loadStoryboards();
    } catch (e) {
      alert(`絵コンテ生成に失敗しました: ${e instanceof Error ? e.message : ''}`);
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
      alert(`画像生成に失敗しました: ${e instanceof Error ? e.message : ''}`);
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
      alert(`画像再生成に失敗しました: ${e instanceof Error ? e.message : ''}`);
    } finally {
      setGeneratingImageId(null);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.updateProject(workspaceSlug, projectId, { status: newStatus });
      loadProject();
    } catch {
      alert("ステータス更新に失敗しました");
    }
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: "overview", label: "概要" },
    { id: "tasks", label: "タスク" },
    { id: "schedule", label: "スケジュール" },
    { id: "budget", label: "予算" },
    { id: "storyboard", label: "絵コンテ" },
  ];

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
        <Link href={`/w/${workspaceSlug}/projects`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ChevronLeft className="w-4 h-4" />
          プロジェクト一覧
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">{project.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={project.status === "完了" ? "green" : "blue"}>{project.status}</Badge>
              <span className="text-xs text-muted-foreground">
                作成日: {new Date(project.created_at).toLocaleDateString('ja-JP')}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {project.status !== "完了" ? (
              <Button size="sm" variant="outline" onClick={() => handleStatusChange("完了")}>完了にする</Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => handleStatusChange("対応中")}>対応中に戻す</Button>
            )}
          </div>
        </div>

        <div className="border-b border-border mb-6">
          <div className="flex gap-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-sm font-semibold mb-3">プロジェクト概要</h3>
              <p className="text-sm text-muted-foreground">{project.overview || "概要が設定されていません。"}</p>
            </div>
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="新しいタスクを追加..." onKeyDown={(e) => e.key === 'Enter' && handleAddTask()} />
              <Button size="sm" onClick={handleAddTask} disabled={addingTask}>
                {addingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                追加
              </Button>
            </div>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {tasks.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">タスクがありません</div>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleTask(task)}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${task.is_completed ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-foreground"}`}
                      >
                        {task.is_completed && <Check className="w-3 h-3" />}
                      </button>
                      <span className={`text-sm ${task.is_completed ? "line-through text-muted-foreground" : ""}`}>{task.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {task.end_date && <span className="text-xs text-muted-foreground">{task.end_date}</span>}
                      <button onClick={() => handleDeleteTask(task.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "schedule" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Input value={newMilestoneName} onChange={(e) => setNewMilestoneName(e.target.value)} placeholder="新しいマイルストーンを追加..." onKeyDown={(e) => e.key === 'Enter' && handleAddMilestone()} />
              <Button size="sm" onClick={handleAddMilestone} disabled={addingMilestone}>
                {addingMilestone ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                追加
              </Button>
            </div>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {milestones.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">マイルストーンがありません</div>
              ) : (
                milestones.map((ms) => (
                  <div key={ms.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <span className="text-sm font-medium">{ms.name}</span>
                      <div className="flex gap-2 mt-0.5">
                        <Badge variant={ms.status === "completed" ? "green" : "default"}>{ms.status}</Badge>
                        {ms.due_date && <span className="text-xs text-muted-foreground">期限: {ms.due_date}</span>}
                      </div>
                    </div>
                    <button onClick={async () => { await api.deleteMilestone(workspaceSlug, ms.id); loadMilestones(); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "budget" && (
          <div className="space-y-4">
            {!budget ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">予算が設定されていません</p>
                <Button size="sm" onClick={async () => { await api.createBudget(workspaceSlug, projectId, { total_budget: 0 }); loadBudget(); }}>予算を作成</Button>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-border bg-card p-6">
                  <h3 className="text-sm font-semibold mb-2">予算概要</h3>
                  <p className="text-2xl font-bold">¥{budget.total_budget.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">{budget.currency}</p>
                </div>
                <div className="rounded-xl border border-border bg-card divide-y divide-border">
                  <div className="px-4 py-3 flex justify-between items-center">
                    <h3 className="text-sm font-semibold">費目一覧</h3>
                    <Button size="sm" variant="outline" onClick={async () => {
                      const title = prompt("費目名を入力:"); const amount = prompt("金額を入力:"); const category = prompt("カテゴリを入力:") || "その他";
                      if (title && amount) { await api.createBudgetItem(workspaceSlug, budget.id, { title, amount: parseInt(amount), category }); loadBudget(); }
                    }}><Plus className="w-3.5 h-3.5" /> 追加</Button>
                  </div>
                  {budgetItems.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">費目がありません</div>
                  ) : (
                    budgetItems.map((item) => (
                      <div key={item.id} className="px-4 py-3 flex justify-between">
                        <div><span className="text-sm font-medium">{item.title}</span><p className="text-xs text-muted-foreground">{item.category}</p></div>
                        <span className="text-sm font-medium">¥{(item.amount * item.quantity).toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "storyboard" && (
          <div className="space-y-4">
            {!draftDetail && storyboards.length === 0 && !showGenForm && (
              <div className="text-center py-8">
                <Wand2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">AIで絵コンテを自動生成できます</p>
                <Button onClick={() => setShowGenForm(true)}><Wand2 className="w-4 h-4" /> 絵コンテを生成</Button>
              </div>
            )}

            {showGenForm && (
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <h3 className="text-sm font-semibold">絵コンテ生成設定</h3>
                <div className="grid gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">タイトル *</label>
                    <Input value={genTitle} onChange={(e) => setGenTitle(e.target.value)} placeholder="絵コンテのタイトル" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">概要・ブリーフ</label>
                    <textarea value={genBrief} onChange={(e) => setGenBrief(e.target.value)} placeholder="映像の概要やブリーフを入力..." className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background min-h-[100px]" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">コマ数</label>
                      <Input type="number" value={genPanelCount} onChange={(e) => setGenPanelCount(parseInt(e.target.value))} min={1} max={30} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">尺（秒）</label>
                      <Input type="number" value={genDuration} onChange={(e) => setGenDuration(parseInt(e.target.value))} min={5} max={600} />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleGenerate} disabled={generating || !genTitle.trim()}>
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    {generating ? "生成中..." : "生成開始"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowGenForm(false)}>キャンセル</Button>
                </div>
              </div>
            )}

            {draftDetail && (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{draftDetail.storyboard.title}</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowGenForm(true)}>
                      <Plus className="w-3.5 h-3.5" /> 新規生成
                    </Button>
                    <Button size="sm" onClick={async () => {
                      try { await api.publishStoryboard(workspaceSlug, draftDetail.storyboard.id); alert("絵コンテを公開しました"); loadStoryboards(); }
                      catch { alert("公開に失敗しました"); }
                    }}>公開</Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {draftDetail.scenes.map((scene) => (
                    <div key={scene.id} className="rounded-xl border border-border bg-card overflow-hidden">
                      <div className="aspect-video bg-muted flex items-center justify-center relative">
                        {scene.image_url ? (
                          <img src={scene.image_url} alt={`Scene ${scene.scene_order}`} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-muted-foreground" />
                        )}
                        {generatingImageId === scene.id && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-white" />
                          </div>
                        )}
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground">#{scene.scene_order}</span>
                          <div className="flex gap-1">
                            {scene.image_url ? (
                              <button onClick={() => handleRegenerateImage(scene.id)} disabled={generatingImageId === scene.id} className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors" title="画像を再生成">
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button onClick={() => handleGenerateImage(scene.id)} disabled={generatingImageId === scene.id || !scene.image_prompt} className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors" title="画像を生成">
                                <ImageIcon className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        {scene.dialogue && (
                          <div><p className="text-xs font-medium text-muted-foreground">セリフ</p><p className="text-sm">{scene.dialogue}</p></div>
                        )}
                        {scene.description && (
                          <div><p className="text-xs font-medium text-muted-foreground">説明</p><p className="text-sm text-muted-foreground">{scene.description}</p></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {storyboards.length > 0 && !draftDetail && (
              <div className="rounded-xl border border-border bg-card divide-y divide-border">
                {storyboards.map((sb) => (
                  <div key={sb.id} className="px-4 py-3 flex justify-between items-center">
                    <span className="text-sm font-medium">{sb.title}</span>
                    <Button size="sm" variant="outline" onClick={async () => { const draft = await api.getDraft(workspaceSlug, sb.id); setDraftDetail(draft); }}>表示</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}

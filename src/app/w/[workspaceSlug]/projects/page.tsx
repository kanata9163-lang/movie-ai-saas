"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type Project, type Client } from "@/lib/api-client";
import { Plus, Search, ArrowUpDown, Filter, ChevronRight, Loader2, Trash2, X } from "lucide-react";
import { useUser } from "@/lib/useUser";

interface ProjectsPageProps {
  params: { workspaceSlug: string };
}

export default function ProjectsPage({ params }: ProjectsPageProps) {
  const { workspaceSlug } = params;
  const { user } = useUser();
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectClientId, setNewProjectClientId] = useState("");
  const [creating, setCreating] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  const loadProjects = async () => {
    try {
      const data = await api.listProjects(workspaceSlug);
      setProjects(data);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    setLoadingClients(true);
    try {
      const data = await api.listClients(workspaceSlug);
      setClients(data);
    } catch {
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [workspaceSlug]);

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const openModal = () => {
    setShowModal(true);
    setNewProjectName("");
    setNewProjectClientId("");
    loadClients();
  };

  const handleCreate = async () => {
    if (!newProjectName.trim()) return;
    setCreating(true);
    try {
      await api.createProject(workspaceSlug, {
        name: newProjectName.trim(),
        client_id: newProjectClientId || undefined,
      });
      setNewProjectName("");
      setNewProjectClientId("");
      setShowModal(false);
      loadProjects();
    } catch {
      alert("作成に失敗しました");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm("このプロジェクトを削除しますか？")) return;
    try {
      await api.deleteProject(workspaceSlug, projectId);
      loadProjects();
    } catch {
      alert("削除に失敗しました");
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "対応中": case "進行中": return "blue" as const;
      case "完了": return "green" as const;
      case "保留": return "yellow" as const;
      default: return "default" as const;
    }
  };

  if (loading) {
    return (
      <>
        <Header title="プロジェクト一覧" userEmail={user?.email} />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="プロジェクト一覧" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">プロジェクト一覧</h1>
          <Button size="sm" onClick={openModal}>
            <Plus className="w-4 h-4" />
            新規プロジェクト追加
          </Button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="キーワードで検索"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm">
            <ArrowUpDown className="w-3.5 h-3.5" />
            並び替え
          </Button>
          <Button variant="outline" size="sm">
            <Filter className="w-3.5 h-3.5" />
            フィルター
          </Button>
        </div>

        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">プロジェクト名</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">ステータス</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">作成日</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">クライアント名</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    プロジェクトが見つかりません
                  </td>
                </tr>
              ) : (
                filtered.map((project) => (
                  <tr key={project.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/w/${workspaceSlug}/projects/${project.id}`} className="font-medium text-sm hover:underline">
                        {project.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={statusColor(project.status)}>{project.status}</Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(project.created_at).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">-</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleDelete(project.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <Link href={`/w/${workspaceSlug}/projects/${project.id}`}>
                          <Button variant="ghost" size="sm">
                            詳細
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">{filtered.length}件のプロジェクト</p>
      </main>

      {/* New Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 z-50">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1 rounded hover:bg-zinc-100 text-zinc-400"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-semibold mb-1">新規プロジェクト</h2>
            <p className="text-sm text-muted-foreground mb-5">新しいプロジェクトを作成します</p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">プロジェクト名</label>
                <Input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="プロジェクト名を入力"
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">クライアント（任意）</label>
                <select
                  value={newProjectClientId}
                  onChange={(e) => setNewProjectClientId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
                  disabled={loadingClients}
                >
                  <option value="">選択してください</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                キャンセル
              </Button>
              <Button onClick={handleCreate} disabled={creating || !newProjectName.trim()}>
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                作成
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

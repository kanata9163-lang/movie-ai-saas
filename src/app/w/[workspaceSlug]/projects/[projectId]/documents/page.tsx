"use client";

import { useState, useEffect, useRef } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/useUser";
import { api, type Project } from "@/lib/api-client";
import Link from "next/link";
import {
  ChevronLeft,
  Trash2,
  Upload,
  FileText,
  ExternalLink,
  Loader2,
} from "lucide-react";

interface DocumentItem {
  id: string;
  project_id: string;
  section: string;
  title: string;
  url: string | null;
  memo: string | null;
  file_name: string | null;
  file_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
}

interface DocumentsPageProps {
  params: { workspaceSlug: string; projectId: string };
}

const SECTIONS = [
  { key: "materials", label: "資料関連" },
  { key: "planning", label: "企画・台本ファイル" },
] as const;

export default function DocumentsPage({ params }: DocumentsPageProps) {
  const { workspaceSlug, projectId } = params;
  const { user } = useUser();
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState("");
  const [savingOverview, setSavingOverview] = useState(false);

  // Per-section form state
  const [formState, setFormState] = useState<
    Record<string, { title: string; url: string; memo: string }>
  >({
    materials: { title: "", url: "", memo: "" },
    planning: { title: "", url: "", memo: "" },
  });
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [uploadingSection, setUploadingSection] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    loadData();
  }, [workspaceSlug, projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectRes, docsRes] = await Promise.all([
        api.getProject(workspaceSlug, projectId),
        fetch(`/api/w/${workspaceSlug}/projects/${projectId}/documents`).then(
          (r) => r.json()
        ),
      ]);
      setProject(projectRes.project);
      setOverview(projectRes.project.overview || "");
      if (docsRes.ok) setDocuments(docsRes.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOverview = async () => {
    setSavingOverview(true);
    try {
      const res = await fetch(
        `/api/w/${workspaceSlug}/projects/${projectId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overview }),
        }
      );
      const json = await res.json();
      if (json.ok) {
        setProject((prev) => (prev ? { ...prev, overview } : prev));
      }
    } catch {
      alert("概要の保存に失敗しました");
    } finally {
      setSavingOverview(false);
    }
  };

  const handleSaveText = async (sectionKey: string) => {
    const form = formState[sectionKey];
    if (!form.title.trim()) {
      alert("タイトルを入力してください");
      return;
    }
    setSavingSection(sectionKey);
    try {
      const res = await fetch(
        `/api/w/${workspaceSlug}/projects/${projectId}/documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            section: sectionKey,
            title: form.title.trim(),
            url: form.url.trim() || null,
            memo: form.memo.trim() || null,
          }),
        }
      );
      const json = await res.json();
      if (json.ok) {
        setDocuments((prev) => [json.data, ...prev]);
        setFormState((prev) => ({
          ...prev,
          [sectionKey]: { title: "", url: "", memo: "" },
        }));
      } else {
        alert(json.error?.message || "保存に失敗しました");
      }
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSavingSection(null);
    }
  };

  const handleFileUpload = async (
    sectionKey: string,
    file: File
  ) => {
    setUploadingSection(sectionKey);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("section", sectionKey);

      const res = await fetch(
        `/api/w/${workspaceSlug}/projects/${projectId}/documents`,
        {
          method: "POST",
          body: formData,
        }
      );
      const json = await res.json();
      if (json.ok) {
        setDocuments((prev) => [json.data, ...prev]);
      } else {
        alert(json.error?.message || "アップロードに失敗しました");
      }
    } catch {
      alert("アップロードに失敗しました");
    } finally {
      setUploadingSection(null);
    }
  };

  const handleDelete = async (doc: DocumentItem) => {
    if (!confirm(`「${doc.title}」を削除しますか？`)) return;
    try {
      const res = await fetch(
        `/api/w/${workspaceSlug}/projects/${projectId}/documents?id=${doc.id}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (json.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      }
    } catch {
      alert("削除に失敗しました");
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };

  const docsForSection = (sectionKey: string) =>
    documents.filter((d) => d.section === sectionKey);

  const totalCount = documents.length;

  if (loading) {
    return (
      <>
        <Header title="資料一覧" userEmail={user?.email} />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="資料一覧" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto bg-zinc-50">
        <div className="max-w-4xl mx-auto p-6">
          {/* Back link */}
          <Link
            href={`/w/${workspaceSlug}/projects/${projectId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            プロジェクト詳細へ戻る
          </Link>

          {/* Title */}
          <h1 className="text-xl font-bold mb-1">資料一覧</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {project?.name} / 全 {totalCount} 件
          </p>

          {/* Project overview */}
          <section className="rounded-xl border border-border bg-white p-5 mb-6">
            <h2 className="text-sm font-semibold text-foreground mb-3">
              プロジェクト概要
            </h2>
            <textarea
              className="w-full min-h-[100px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="プロジェクトの概要を入力..."
              value={overview}
              onChange={(e) => setOverview(e.target.value)}
            />
            <div className="flex justify-end mt-2">
              <Button
                size="sm"
                onClick={handleSaveOverview}
                disabled={savingOverview}
              >
                {savingOverview ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : null}
                概要を保存
              </Button>
            </div>
          </section>

          {/* Document sections */}
          {SECTIONS.map(({ key, label }) => {
            const sectionDocs = docsForSection(key);
            const form = formState[key];
            return (
              <section
                key={key}
                className="rounded-xl border border-border bg-white p-5 mb-6"
              >
                <h2 className="text-sm font-semibold text-foreground mb-4">
                  {label}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    {sectionDocs.length}件
                  </span>
                </h2>

                {/* Input form */}
                <div className="space-y-3 mb-4">
                  <input
                    type="text"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="タイトル"
                    value={form.title}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], title: e.target.value },
                      }))
                    }
                  />
                  <input
                    type="text"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="URL / 共有リンク"
                    value={form.url}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], url: e.target.value },
                      }))
                    }
                  />
                  <textarea
                    className="w-full min-h-[60px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="メモ / テキスト"
                    value={form.memo}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], memo: e.target.value },
                      }))
                    }
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSaveText(key)}
                      disabled={savingSection === key}
                    >
                      {savingSection === key ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : null}
                      テキストを保存
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRefs.current[key]?.click()}
                      disabled={uploadingSection === key}
                    >
                      {uploadingSection === key ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Upload className="w-3 h-3" />
                      )}
                      ファイルを保存
                    </Button>
                    <input
                      ref={(el) => {
                        fileInputRefs.current[key] = el;
                      }}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload(key, file);
                          e.target.value = "";
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Documents table */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-border">
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                          資料名
                        </th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground w-28">
                          更新日
                        </th>
                        <th className="text-center px-4 py-2 font-medium text-muted-foreground w-16">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectionDocs.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-6 text-center text-muted-foreground"
                          >
                            登録された資料はありません
                          </td>
                        </tr>
                      ) : (
                        sectionDocs.map((doc) => (
                          <tr
                            key={doc.id}
                            className="border-b border-border last:border-b-0 hover:bg-zinc-50"
                          >
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                {doc.url ? (
                                  <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline flex items-center gap-1"
                                  >
                                    {doc.title}
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                ) : doc.file_path ? (
                                  <span className="flex items-center gap-1">
                                    {doc.title}
                                    <span className="text-xs text-muted-foreground">
                                      (ファイル)
                                    </span>
                                  </span>
                                ) : (
                                  <span>{doc.title}</span>
                                )}
                              </div>
                              {doc.memo && (
                                <p className="text-xs text-muted-foreground mt-1 ml-6">
                                  {doc.memo}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground text-xs">
                              {formatDate(doc.updated_at)}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <button
                                onClick={() => handleDelete(doc)}
                                className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                                title="削除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}

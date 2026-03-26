"use client";

import { useState, useEffect, useRef } from "react";
import { FolderPlus, Check, Loader2, ChevronDown } from "lucide-react";

interface Project {
  id: string;
  name: string;
  status: string;
}

interface LinkToProjectProps {
  workspaceSlug: string;
  resourceType: "ad_analysis" | "trend_report" | "knowledge_item" | "video_project" | "asset";
  resourceId: string;
  currentProjectId?: string | null;
  onLinked?: (projectId: string, projectName: string) => void;
  compact?: boolean;
}

export default function LinkToProject({
  workspaceSlug,
  resourceType,
  resourceId,
  currentProjectId,
  onLinked,
  compact = false,
}: LinkToProjectProps) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(currentProjectId || null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && projects.length === 0) {
      setLoading(true);
      fetch(`/api/w/${workspaceSlug}/projects`)
        .then((r) => r.json())
        .then((res) => {
          if (res.ok) setProjects(res.data || []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open, workspaceSlug, projects.length]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLink = async (projectId: string) => {
    setLinking(true);
    try {
      const res = await fetch(`/api/w/${workspaceSlug}/link-to-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceType, resourceId, projectId }),
      });
      const json = await res.json();
      if (json.ok) {
        setLinkedProjectId(projectId);
        const proj = projects.find((p) => p.id === projectId);
        onLinked?.(projectId, proj?.name || "");
        setOpen(false);
      } else {
        alert(json.error?.message || "紐付けに失敗しました");
      }
    } catch {
      alert("紐付けに失敗しました");
    } finally {
      setLinking(false);
    }
  };

  const linkedProject = projects.find((p) => p.id === linkedProjectId);

  if (compact) {
    return (
      <div className="relative inline-block" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md border border-border bg-white hover:bg-zinc-50 transition-colors text-zinc-600"
        >
          {linkedProjectId ? (
            <>
              <Check className="w-3 h-3 text-green-500" />
              <span className="max-w-[100px] truncate">{linkedProject?.name || "紐付済"}</span>
            </>
          ) : (
            <>
              <FolderPlus className="w-3 h-3" />
              PJに追加
            </>
          )}
          <ChevronDown className="w-3 h-3" />
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-border rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              </div>
            ) : projects.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-2">プロジェクトがありません</p>
            ) : (
              projects.map((proj) => (
                <button
                  key={proj.id}
                  onClick={() => handleLink(proj.id)}
                  disabled={linking}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 transition-colors flex items-center justify-between"
                >
                  <span className="truncate">{proj.name}</span>
                  {linkedProjectId === proj.id && <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-white hover:bg-zinc-50 transition-colors text-zinc-700"
      >
        {linkedProjectId ? (
          <>
            <Check className="w-3.5 h-3.5 text-green-500" />
            {linkedProject?.name || "プロジェクトに紐付済"}
          </>
        ) : (
          <>
            <FolderPlus className="w-3.5 h-3.5" />
            プロジェクトに追加
          </>
        )}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-border rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
            </div>
          ) : projects.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-3">プロジェクトがありません</p>
          ) : (
            projects.map((proj) => (
              <button
                key={proj.id}
                onClick={() => handleLink(proj.id)}
                disabled={linking}
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-zinc-50 transition-colors flex items-center justify-between"
              >
                <span className="truncate">{proj.name}</span>
                {linkedProjectId === proj.id && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

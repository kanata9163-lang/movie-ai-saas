"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/useUser";
import { Plus, Video, Search } from "lucide-react";
import LinkToProject from "@/components/LinkToProject";
import LoadingAnimation from "@/components/LoadingAnimation";
import { STAGE_LABELS, PipelineStage } from "@/lib/video/pipeline/types";

interface VideoListProps {
  params: { workspaceSlug: string };
}

interface VideoProject {
  id: string;
  title: string;
  status: string;
  source_url: string;
  aspect_ratio: string;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

const statusColor = (status: string) => {
  if (status === 'completed') return 'bg-green-100 text-green-800';
  if (status === 'failed') return 'bg-red-100 text-red-800';
  if (status === 'pending') return 'bg-zinc-100 text-zinc-600';
  return 'bg-blue-100 text-blue-800';
};

export default function VideoListPage({ params }: VideoListProps) {
  const { workspaceSlug } = params;
  const { user } = useUser();
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`/api/w/${workspaceSlug}/video-projects`)
      .then(r => r.json())
      .then(res => { setProjects(res.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [workspaceSlug]);

  const filtered = projects.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.source_url?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Header title="動画プロジェクト" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="タイトルやURLで検索..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background w-72"
              />
            </div>
            <span className="text-sm text-muted-foreground">{filtered.length}件</span>
          </div>
          <Link href={`/w/${workspaceSlug}/video/new`}>
            <Button className="bg-zinc-900 text-white hover:bg-zinc-800">
              <Plus className="w-4 h-4" />新規動画生成
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingAnimation message="読み込み中..." />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Video className="w-12 h-12 mb-3 text-zinc-300" />
            <p className="text-sm">動画プロジェクトはまだありません</p>
            <Link href={`/w/${workspaceSlug}/video/new`} className="mt-3">
              <Button variant="outline" size="sm">
                <Plus className="w-3.5 h-3.5" />新規作成
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => (
              <Link key={p.id} href={`/w/${workspaceSlug}/video/${p.id}`} className="block">
                <div className="rounded-xl border border-border bg-card hover:shadow-md transition-shadow p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-muted-foreground" />
                      <h3 className="font-semibold text-sm truncate">{p.title || '無題'}</h3>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor(p.status)}`}>
                      {STAGE_LABELS[p.status as PipelineStage] || p.status}
                    </span>
                  </div>
                  {p.source_url && (
                    <p className="text-xs text-muted-foreground truncate mb-2">{p.source_url}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                    <span>{p.aspect_ratio} - {new Date(p.created_at).toLocaleDateString('ja-JP')}</span>
                    <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                      <LinkToProject
                        workspaceSlug={workspaceSlug}
                        resourceType="video_project"
                        resourceId={p.id}
                        currentProjectId={p.project_id}
                        compact
                      />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

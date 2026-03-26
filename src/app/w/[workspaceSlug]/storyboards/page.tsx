"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { api, type Storyboard } from "@/lib/api-client";
import { Search, Film, ChevronRight, Wand2 } from "lucide-react";
import { useUser } from "@/lib/useUser";
import { CardSkeleton } from "@/components/Skeleton";

interface StoryboardsPageProps {
  params: { workspaceSlug: string };
}

interface StoryboardWithProject extends Storyboard {
  project_name: string | null;
}

export default function StoryboardsPage({ params }: StoryboardsPageProps) {
  const { workspaceSlug } = params;
  const { user } = useUser();
  const [storyboards, setStoryboards] = useState<StoryboardWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadStoryboards();
  }, [workspaceSlug]);

  const loadStoryboards = async () => {
    try {
      const data = await api.listAllStoryboards(workspaceSlug);
      setStoryboards(data as StoryboardWithProject[]);
    } catch {
      setStoryboards([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = storyboards.filter((sb) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      sb.title.toLowerCase().includes(q) ||
      (sb.project_name || "").toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <>
        <Header title="絵コンテ一覧" userEmail={user?.email} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="絵コンテ一覧" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto p-6">
        {/* Search */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="タイトルやプロジェクト名で検索..."
              className="pl-9"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {filtered.length}件
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <Film className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <p className="text-base font-medium text-muted-foreground mb-2">
              {search ? "検索結果が見つかりません" : "まだ絵コンテがありません"}
            </p>
            <p className="text-sm text-muted-foreground">
              プロジェクト詳細から「絵コンテを作成」で新しい絵コンテを生成できます
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((sb) => (
              <Link
                key={sb.id}
                href={`/w/${workspaceSlug}/storyboards/${sb.id}`}
                className="block"
              >
                <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center">
                        <Wand2 className="w-4 h-4 text-zinc-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground truncate max-w-[200px]">
                          {sb.title}
                        </h3>
                        {sb.project_name && (
                          <p className="text-[11px] text-muted-foreground">
                            {sb.project_name}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={sb.current_published_version_id ? "green" : "default"}
                      className="text-[10px] flex-shrink-0"
                    >
                      {sb.current_published_version_id ? "公開済み" : "ドラフト"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {new Date(sb.created_at).toLocaleDateString("ja-JP", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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

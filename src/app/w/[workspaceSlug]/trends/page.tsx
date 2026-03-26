"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/useUser";
import {
  TrendingUp,
  Search,
  Loader2,
  Hash,
  Lightbulb,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clapperboard,
} from "lucide-react";
import LinkToProject from "@/components/LinkToProject";

interface TrendsPageProps {
  params: { workspaceSlug: string };
}

interface TrendReport {
  id: string;
  topic: string;
  platform: string | null;
  report_content: {
    summary?: string;
    trends?: Array<{
      title: string;
      description: string;
      popularity: string;
      relevance: string;
      contentIdeas: string[];
    }>;
    hashtags?: string[];
    bestPractices?: string[];
    timingAdvice?: string;
    competitorInsights?: string;
  };
  source_urls: string[];
  generated_at: string;
}

const PLATFORMS = [
  { value: "", label: "全プラットフォーム" },
  { value: "TikTok", label: "TikTok" },
  { value: "Instagram Reels", label: "Instagram Reels" },
  { value: "YouTube Shorts", label: "YouTube Shorts" },
  { value: "X (Twitter)", label: "X (Twitter)" },
];

const popularityColor = (p: string) => {
  if (p === "high") return "bg-red-100 text-red-700";
  if (p === "medium") return "bg-amber-100 text-amber-700";
  return "bg-zinc-100 text-zinc-600";
};

export default function TrendsPage({ params }: TrendsPageProps) {
  const { workspaceSlug } = params;
  const { user } = useUser();
  const [reports, setReports] = useState<TrendReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/w/${workspaceSlug}/trends`)
      .then((r) => r.json())
      .then((res) => { setReports(res.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [workspaceSlug]);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/w/${workspaceSlug}/trends`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, platform }),
      });
      const data = await res.json();
      if (data.ok && data.data) {
        setReports((prev) => [data.data, ...prev]);
        setExpandedId(data.data.id);
        setTopic("");
      } else {
        alert(data.error || "生成に失敗しました");
      }
    } catch {
      alert("生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Header title="トレンドリサーチ" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto p-6">
        {/* Input Section */}
        <div className="rounded-xl border border-border bg-card p-6 mb-6">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            トレンド分析を生成
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !generating && handleGenerate()}
              placeholder="トピック・業界を入力（例：美容、フィットネス、SaaS）"
              className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
            />
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-background"
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <Button
              onClick={handleGenerate}
              disabled={generating || !topic.trim()}
              className="bg-zinc-900 text-white hover:bg-zinc-800"
            >
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin" />分析中...</>
              ) : (
                <><Search className="w-4 h-4" />分析開始</>
              )}
            </Button>
          </div>
        </div>

        {/* Reports List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <TrendingUp className="w-12 h-12 mb-3 text-zinc-300" />
            <p className="text-sm">トレンドレポートはまだありません</p>
            <p className="text-xs mt-1">上のフォームからトピックを入力して分析を開始してください</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => {
              const rc = report.report_content;
              const expanded = expandedId === report.id;
              return (
                <div key={report.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setExpandedId(expanded ? null : report.id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm">{report.topic}</h3>
                          {report.platform && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                              {report.platform}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(report.generated_at).toLocaleDateString("ja-JP")} - {rc.summary?.slice(0, 80)}...
                        </p>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <LinkToProject
                          workspaceSlug={workspaceSlug}
                          resourceType="trend_report"
                          resourceId={report.id}
                          compact
                        />
                      </div>
                    </div>
                    {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>

                  {expanded && (
                    <div className="px-5 pb-5 border-t border-border pt-4 space-y-5">
                      {/* Summary */}
                      {rc.summary && (
                        <p className="text-sm text-zinc-700">{rc.summary}</p>
                      )}

                      {/* Trends */}
                      {rc.trends && rc.trends.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">トレンド</h4>
                          <div className="space-y-3">
                            {rc.trends.map((trend, i) => (
                              <div key={i} className="rounded-lg border border-border p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm">{trend.title}</span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${popularityColor(trend.popularity)}`}>
                                    {trend.popularity}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mb-2">{trend.description}</p>
                                {trend.contentIdeas && trend.contentIdeas.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {trend.contentIdeas.map((idea, j) => (
                                      <span key={j} className="text-[10px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 flex items-center gap-1">
                                        <Lightbulb className="w-2.5 h-2.5" />{idea}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Hashtags */}
                      {rc.hashtags && rc.hashtags.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">ハッシュタグ</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {rc.hashtags.map((tag, i) => (
                              <span key={i} className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 flex items-center gap-1">
                                <Hash className="w-3 h-3" />{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Best Practices */}
                      {rc.bestPractices && rc.bestPractices.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">ベストプラクティス</h4>
                          <ul className="space-y-1">
                            {rc.bestPractices.map((bp, i) => (
                              <li key={i} className="text-xs text-zinc-700 flex items-start gap-2">
                                <ArrowRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-green-600" />{bp}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Timing */}
                      {rc.timingAdvice && (
                        <div className="flex items-start gap-2 text-xs text-zinc-700 bg-amber-50 rounded-lg p-3">
                          <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-600" />
                          <span>{rc.timingAdvice}</span>
                        </div>
                      )}

                      {/* Source URLs */}
                      {report.source_urls && report.source_urls.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">参照元</h4>
                          <div className="flex flex-wrap gap-2">
                            {report.source_urls.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-blue-600 hover:underline flex items-center gap-1">
                                <ExternalLink className="w-2.5 h-2.5" />{new URL(url).hostname}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* CTA */}
                      <div className="pt-2">
                        <Link href={`/w/${workspaceSlug}/video/new`}>
                          <Button className="bg-zinc-900 text-white hover:bg-zinc-800" size="sm">
                            <Clapperboard className="w-3.5 h-3.5" />
                            このトレンドで動画を作成
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

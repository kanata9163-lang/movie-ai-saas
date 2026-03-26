"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/useUser";
import {
  Search,
  Loader2,
  Megaphone,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  CheckCircle,
  XCircle,
  Clapperboard,
  Zap,
  Target,
  Palette,
  ExternalLink,
  Film,
  Eye,
  Sparkles,
} from "lucide-react";
import LinkToProject from "@/components/LinkToProject";

interface AdResearchPageProps {
  params: { workspaceSlug: string };
}

interface CreativeExample {
  brandName: string;
  adFormat: string;
  visualDescription: string;
  copyText: string;
  whyItWorks: string;
  sourceUrl?: string;
  thumbnailUrl?: string;
}

interface Storyboard {
  [key: string]: string;
}

interface AdPattern {
  patternName: string;
  description: string;
  effectiveness: string;
  examples?: string[];
  creativeExamples?: CreativeExample[];
  mockupImage?: string;
  storyboard?: Storyboard;
  keyElements: {
    hook: string;
    body: string;
    cta: string;
  };
  targetAudience: string;
  estimatedEngagement: string;
}

interface AdLibraryLink {
  name: string;
  url: string;
}

interface ReferenceSource {
  title: string;
  url: string;
}

interface AdAnalysis {
  id: string;
  query: string;
  platform: string;
  results: {
    adPatterns?: AdPattern[];
    adLibraryLinks?: AdLibraryLink[];
    referenceSources?: ReferenceSource[];
    overallInsights?: {
      topFormats?: string[];
      colorTrends?: string[];
      musicStyles?: string[];
      optimalDuration?: string;
      doList?: string[];
      dontList?: string[];
    };
    recommendations?: Array<{
      title: string;
      description: string;
      priority: string;
    }>;
  };
  insights: Record<string, unknown> | null;
  created_at: string;
}

const PLATFORMS = [
  { value: "TikTok", label: "TikTok" },
  { value: "Instagram", label: "Instagram" },
  { value: "YouTube", label: "YouTube" },
  { value: "X (Twitter)", label: "X (Twitter)" },
  { value: "Facebook", label: "Facebook" },
  { value: "LINE", label: "LINE" },
];

const effectivenessColor = (e: string) => {
  if (e === "high") return "bg-green-100 text-green-700";
  if (e === "medium") return "bg-amber-100 text-amber-700";
  return "bg-zinc-100 text-zinc-600";
};

const priorityColor = (p: string) => {
  if (p === "high") return "border-l-red-500";
  if (p === "medium") return "border-l-amber-500";
  return "border-l-zinc-300";
};

export default function AdResearchPage({ params }: AdResearchPageProps) {
  const { workspaceSlug } = params;
  const { user } = useUser();
  const [analyses, setAnalyses] = useState<AdAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("TikTok");
  const [industry, setIndustry] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/w/${workspaceSlug}/ad-research`)
      .then((r) => r.json())
      .then((res) => { setAnalyses(res.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [workspaceSlug]);

  const handleGenerate = async () => {
    if (!query.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/w/${workspaceSlug}/ad-research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, platform, industry }),
      });
      const data = await res.json();
      if (data.ok && data.data) {
        setAnalyses((prev) => [data.data, ...prev]);
        setExpandedId(data.data.id);
        setQuery("");
      } else {
        alert(data.error || "分析に失敗しました");
      }
    } catch {
      alert("分析に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Header title="広告クリエイティブ分析" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto p-6">
        {/* Input Section */}
        <div className="rounded-xl border border-border bg-card p-6 mb-6">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Megaphone className="w-4 h-4" />
            広告クリエイティブを分析
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !generating && handleGenerate()}
              placeholder="検索クエリ（例：化粧品 広告）"
              className="sm:col-span-2 px-3 py-2 text-sm border border-border rounded-lg bg-background"
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
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="業界（任意）"
              className="px-3 py-2 text-sm border border-border rounded-lg bg-background"
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              onClick={handleGenerate}
              disabled={generating || !query.trim()}
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

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : analyses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Megaphone className="w-12 h-12 mb-3 text-zinc-300" />
            <p className="text-sm">広告分析はまだありません</p>
            <p className="text-xs mt-1">上のフォームからクエリを入力して分析を開始してください</p>
          </div>
        ) : (
          <div className="space-y-4">
            {analyses.map((analysis) => {
              const r = analysis.results;
              const expanded = expandedId === analysis.id;
              return (
                <div key={analysis.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setExpandedId(expanded ? null : analysis.id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm">{analysis.query}</h3>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                            {analysis.platform}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(analysis.created_at).toLocaleDateString("ja-JP")} - {r.adPatterns?.length || 0}パターン検出
                        </p>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <LinkToProject
                          workspaceSlug={workspaceSlug}
                          resourceType="ad_analysis"
                          resourceId={analysis.id}
                          compact
                        />
                      </div>
                    </div>
                    {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>

                  {expanded && (
                    <div className="px-5 pb-5 border-t border-border pt-4 space-y-5">
                      {/* Ad Library Links */}
                      {r.adLibraryLinks && r.adLibraryLinks.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {r.adLibraryLinks.map((link, i) => (
                            <a
                              key={i}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {link.name}で実際の広告を見る
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Ad Patterns */}
                      {r.adPatterns && r.adPatterns.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">広告パターン</h4>
                          <div className="space-y-4">
                            {r.adPatterns.map((pattern, i) => (
                              <div key={i} className="rounded-lg border border-border overflow-hidden">
                                {/* Pattern Header */}
                                <div className="p-4 bg-zinc-50 border-b border-border">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-sm">{pattern.patternName}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${effectivenessColor(pattern.effectiveness)}`}>
                                      効果: {pattern.effectiveness}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{pattern.description}</p>
                                </div>

                                <div className="p-4 space-y-4">
                                  {/* Mockup Image + Creative Examples side by side */}
                                  {(pattern.mockupImage || (pattern.creativeExamples && pattern.creativeExamples.length > 0)) && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                      {/* Mockup Image */}
                                      {pattern.mockupImage && (
                                        <div>
                                          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1">
                                            <Sparkles className="w-3 h-3" />AIモックアップ
                                          </p>
                                          <div className="relative rounded-lg overflow-hidden border border-border bg-black flex items-center justify-center" style={{ maxHeight: '400px' }}>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                              src={pattern.mockupImage}
                                              alt={`${pattern.patternName} mockup`}
                                              className="max-h-[400px] object-contain"
                                            />
                                          </div>
                                        </div>
                                      )}

                                      {/* Creative Examples */}
                                      {pattern.creativeExamples && pattern.creativeExamples.length > 0 && (
                                        <div>
                                          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1">
                                            <Eye className="w-3 h-3" />具体的なクリエイティブ例
                                          </p>
                                          <div className="space-y-2">
                                            {pattern.creativeExamples.map((ex, j) => (
                                              <div key={j} className="rounded-lg bg-gradient-to-br from-zinc-50 to-white border border-zinc-200 p-3">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                  <span className="text-xs font-bold text-zinc-800">{ex.brandName}</span>
                                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-600">{ex.adFormat}</span>
                                                </div>
                                                <p className="text-xs text-zinc-600 mb-1.5 leading-relaxed">{ex.visualDescription}</p>
                                                {ex.copyText && (
                                                  <div className="bg-white rounded border border-dashed border-zinc-300 p-2 mb-1.5">
                                                    <p className="text-[10px] text-zinc-400 mb-0.5">広告コピー</p>
                                                    <p className="text-xs text-zinc-800 font-medium italic">&quot;{ex.copyText}&quot;</p>
                                                  </div>
                                                )}
                                                <p className="text-[10px] text-emerald-600 flex items-center gap-1">
                                                  <CheckCircle className="w-3 h-3" />{ex.whyItWorks}
                                                </p>
                                                {ex.sourceUrl && ex.sourceUrl.startsWith('http') && (
                                                  <a
                                                    href={ex.sourceUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-blue-600 hover:text-blue-800 hover:underline"
                                                  >
                                                    <ExternalLink className="w-3 h-3" />参考リンク
                                                  </a>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Storyboard */}
                                  {pattern.storyboard && Object.keys(pattern.storyboard).length > 0 && (
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1">
                                        <Film className="w-3 h-3" />ストーリーボード（時間構成）
                                      </p>
                                      <div className="flex overflow-x-auto gap-2 pb-2">
                                        {Object.entries(pattern.storyboard).map(([key, val], j) => (
                                          <div key={j} className="flex-shrink-0 w-48 rounded-lg bg-zinc-900 text-white p-3 relative">
                                            <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-white text-zinc-900 flex items-center justify-center text-[10px] font-bold">
                                              {j + 1}
                                            </div>
                                            <p className="text-[10px] text-zinc-400 mt-4 mb-1">{key.replace('scene', 'シーン')}</p>
                                            <p className="text-xs leading-relaxed">{val}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Key Elements */}
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <div className="rounded bg-zinc-50 p-2">
                                      <p className="text-[10px] font-semibold text-zinc-400 mb-1 flex items-center gap-1">
                                        <Zap className="w-3 h-3" />フック
                                      </p>
                                      <p className="text-xs text-zinc-700">{pattern.keyElements?.hook}</p>
                                    </div>
                                    <div className="rounded bg-zinc-50 p-2">
                                      <p className="text-[10px] font-semibold text-zinc-400 mb-1">本文</p>
                                      <p className="text-xs text-zinc-700">{pattern.keyElements?.body}</p>
                                    </div>
                                    <div className="rounded bg-zinc-50 p-2">
                                      <p className="text-[10px] font-semibold text-zinc-400 mb-1 flex items-center gap-1">
                                        <Target className="w-3 h-3" />CTA
                                      </p>
                                      <p className="text-xs text-zinc-700">{pattern.keyElements?.cta}</p>
                                    </div>
                                  </div>

                                  {pattern.targetAudience && (
                                    <p className="text-[10px] text-muted-foreground">
                                      ターゲット: {pattern.targetAudience}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Overall Insights */}
                      {r.overallInsights && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">総合インサイト</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {r.overallInsights.topFormats && r.overallInsights.topFormats.length > 0 && (
                              <div className="rounded-lg bg-zinc-50 p-3">
                                <p className="text-[10px] font-semibold text-zinc-400 mb-1.5">効果的なフォーマット</p>
                                {r.overallInsights.topFormats.map((f, i) => (
                                  <p key={i} className="text-xs text-zinc-700 flex items-center gap-1">
                                    <ArrowRight className="w-3 h-3 text-blue-500" />{f}
                                  </p>
                                ))}
                              </div>
                            )}
                            {r.overallInsights.colorTrends && r.overallInsights.colorTrends.length > 0 && (
                              <div className="rounded-lg bg-zinc-50 p-3">
                                <p className="text-[10px] font-semibold text-zinc-400 mb-1.5 flex items-center gap-1">
                                  <Palette className="w-3 h-3" />カラートレンド
                                </p>
                                {r.overallInsights.colorTrends.map((c, i) => (
                                  <p key={i} className="text-xs text-zinc-700">{c}</p>
                                ))}
                              </div>
                            )}
                            {r.overallInsights.optimalDuration && (
                              <div className="rounded-lg bg-zinc-50 p-3">
                                <p className="text-[10px] font-semibold text-zinc-400 mb-1.5">最適な動画時間</p>
                                <p className="text-xs text-zinc-700">{r.overallInsights.optimalDuration}</p>
                              </div>
                            )}
                          </div>
                          {/* Do / Don't */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                            {r.overallInsights.doList && r.overallInsights.doList.length > 0 && (
                              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                                <p className="text-[10px] font-semibold text-green-700 mb-1.5">DO</p>
                                {r.overallInsights.doList.map((d, i) => (
                                  <p key={i} className="text-xs text-green-800 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" />{d}
                                  </p>
                                ))}
                              </div>
                            )}
                            {r.overallInsights.dontList && r.overallInsights.dontList.length > 0 && (
                              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                                <p className="text-[10px] font-semibold text-red-700 mb-1.5">DON&apos;T</p>
                                {r.overallInsights.dontList.map((d, i) => (
                                  <p key={i} className="text-xs text-red-800 flex items-center gap-1">
                                    <XCircle className="w-3 h-3" />{d}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Recommendations */}
                      {r.recommendations && r.recommendations.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">推奨アクション</h4>
                          <div className="space-y-2">
                            {r.recommendations.map((rec, i) => (
                              <div key={i} className={`rounded-lg border-l-4 ${priorityColor(rec.priority)} border border-border p-3`}>
                                <p className="font-medium text-sm mb-1">{rec.title}</p>
                                <p className="text-xs text-muted-foreground">{rec.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Reference Sources */}
                      {r.referenceSources && r.referenceSources.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">参考ソース</h4>
                          <div className="flex flex-wrap gap-2">
                            {r.referenceSources.map((src, i) => (
                              <a
                                key={i}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-md hover:bg-zinc-100 hover:text-zinc-800 transition-colors max-w-xs truncate"
                              >
                                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{src.title}</span>
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
                            この広告パターンで動画を作成
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

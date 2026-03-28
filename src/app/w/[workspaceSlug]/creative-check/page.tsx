"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/useUser";
import { Loader2, BarChart3, TrendingUp, Target, Zap, ChevronDown, ChevronUp } from "lucide-react";

interface CreativeCheckProps {
  params: { workspaceSlug: string };
}

interface VideoProject {
  id: string;
  title: string;
  status: string;
}

interface PlatformResult {
  platform: string;
  platformLabel: string;
  score: number;
  scoreLabel: string;
  metrics: Record<string, { predicted: string; benchmark: string; verdict: string }>;
  tips: string[];
  bestFor: string;
}

export default function CreativeCheckPage({ params }: CreativeCheckProps) {
  const { workspaceSlug } = params;
  const { user } = useUser();

  const [inputMode, setInputMode] = useState<'text' | 'project'>('text');
  const [scriptText, setScriptText] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [platforms, setPlatforms] = useState<string[]>(["meta", "tiktok", "youtube"]);
  const [industry, setIndustry] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [duration, setDuration] = useState("30");
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<PlatformResult[] | null>(null);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/w/${workspaceSlug}/video-projects`)
      .then(r => r.json())
      .then(res => {
        if (res.ok) setProjects((res.data || []).filter((p: VideoProject) => p.status === 'completed' || p.status === 'script_ready' || p.status === 'images_ready'));
      })
      .catch(() => {});
  }, [workspaceSlug]);

  const handleAnalyze = async () => {
    if (inputMode === 'text' && !scriptText.trim()) return alert('クリエイティブ内容を入力してください');
    if (inputMode === 'project' && !selectedProjectId) return alert('プロジェクトを選択してください');
    if (platforms.length === 0) return alert('少なくとも1つのプラットフォームを選択してください');

    setAnalyzing(true);
    try {
      const res = await fetch(`/api/w/${workspaceSlug}/creative-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: inputMode,
          scriptText: scriptText.trim(),
          projectId: selectedProjectId,
          platforms,
          industry: industry.trim(),
          targetAudience: targetAudience.trim(),
          duration: parseInt(duration),
        }),
      });
      const result = await res.json();
      if (result.ok) {
        setResults(result.data);
        if (result.data?.length > 0) setExpandedPlatform(result.data[0].platform);
      } else {
        alert(result.error || '分析に失敗しました');
      }
    } catch {
      alert('分析に失敗しました');
    } finally {
      setAnalyzing(false);
    }
  };

  const togglePlatform = (p: string) => {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const platformLabels: Record<string, { label: string; color: string; bg: string }> = {
    meta: { label: 'Meta広告', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
    tiktok: { label: 'TikTok広告', color: 'text-pink-600', bg: 'bg-pink-50 border-pink-200' },
    youtube: { label: 'YouTube広告', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  };

  return (
    <>
      <Header title="クリエイティブ分析" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            <div>
              <h1 className="text-xl font-bold">クリエイティブ分析</h1>
              <p className="text-sm text-muted-foreground">広告クリエイティブの予測パフォーマンスを各媒体ごとに分析</p>
            </div>
          </div>

          {/* Input Section */}
          <div className="rounded-xl border border-border bg-card p-5 mb-6 space-y-4">
            {/* Input Mode Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setInputMode('text')}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors ${inputMode === 'text' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium' : 'border-border hover:bg-muted'}`}
              >
                テキスト入力
              </button>
              <button
                onClick={() => setInputMode('project')}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors ${inputMode === 'project' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium' : 'border-border hover:bg-muted'}`}
              >
                既存プロジェクトから
              </button>
            </div>

            {inputMode === 'text' ? (
              <div>
                <label className="text-sm font-medium block mb-1.5">クリエイティブ内容</label>
                <textarea
                  value={scriptText}
                  onChange={e => setScriptText(e.target.value)}
                  placeholder="台本テキスト、ナレーション、映像の説明など広告クリエイティブの内容を入力してください"
                  className="w-full px-4 py-3 text-sm border border-border rounded-lg bg-background resize-none"
                  rows={6}
                />
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium block mb-1.5">動画プロジェクトを選択</label>
                <select
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background"
                >
                  <option value="">プロジェクトを選択...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.title || '無題'} ({p.status})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Additional context */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">業界（任意）</label>
                <input
                  type="text"
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                  placeholder="例: 化粧品、SaaS、飲食"
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">ターゲット（任意）</label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={e => setTargetAudience(e.target.value)}
                  placeholder="例: 20代女性"
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">動画尺（秒）</label>
                <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background">
                  <option value="6">6秒</option>
                  <option value="15">15秒</option>
                  <option value="30">30秒</option>
                  <option value="60">60秒</option>
                </select>
              </div>
            </div>

            {/* Platform Selection */}
            <div>
              <label className="text-sm font-medium block mb-2">分析対象プラットフォーム</label>
              <div className="flex gap-3">
                {Object.entries(platformLabels).map(([key, { label, bg }]) => (
                  <button
                    key={key}
                    onClick={() => togglePlatform(key)}
                    className={`px-4 py-2.5 text-sm rounded-lg border-2 transition-all ${
                      platforms.includes(key) ? bg + ' font-medium' : 'border-border opacity-50 hover:opacity-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleAnalyze} disabled={analyzing} className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white">
              {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" />分析中...</> : <><BarChart3 className="w-4 h-4" />クリエイティブを分析</>}
            </Button>
          </div>

          {/* Results */}
          {results && results.length > 0 && (
            <div className="space-y-4">
              {/* Score Comparison */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 text-indigo-600" />
                  プラットフォーム別スコア比較
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  {results.map(r => {
                    const pInfo = platformLabels[r.platform] || { label: r.platformLabel, color: 'text-zinc-600' };
                    return (
                      <div key={r.platform} className="text-center">
                        <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-2xl font-bold text-white mb-2 ${
                          r.score >= 80 ? 'bg-green-500' : r.score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                        }`}>
                          {r.score}
                        </div>
                        <p className={`text-sm font-semibold ${pInfo.color}`}>{pInfo.label}</p>
                        <p className="text-xs text-muted-foreground">{r.scoreLabel}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{r.bestFor}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detailed Results */}
              {results.map(r => {
                const pInfo = platformLabels[r.platform] || { label: r.platformLabel, color: 'text-zinc-600', bg: 'bg-zinc-50 border-zinc-200' };
                const isExpanded = expandedPlatform === r.platform;
                return (
                  <div key={r.platform} className={`rounded-xl border-2 ${pInfo.bg} overflow-hidden`}>
                    <button
                      onClick={() => setExpandedPlatform(isExpanded ? null : r.platform)}
                      className="w-full flex items-center justify-between p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                          r.score >= 80 ? 'bg-green-500' : r.score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                        }`}>{r.score}</div>
                        <div className="text-left">
                          <p className={`font-semibold ${pInfo.color}`}>{pInfo.label}</p>
                          <p className="text-xs text-muted-foreground">{r.scoreLabel}</p>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4">
                        {/* Metrics */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {Object.entries(r.metrics).map(([key, val]) => {
                            const labels: Record<string, string> = { ctr: 'CTR', cpm: 'CPM', cpc: 'CPC', cvr: 'CVR', hookRate: 'フック率', completionRate: '完視聴率', cpa: 'CPA', roas: 'ROAS', vtr: 'VTR', thumbStopRate: 'サムストップ率' };
                            const verdictColors: Record<string, string> = { above: 'text-green-600', below: 'text-red-500', average: 'text-amber-600' };
                            return (
                              <div key={key} className="bg-white rounded-lg p-2.5 border">
                                <p className="text-[10px] text-muted-foreground">{labels[key] || key}</p>
                                <p className={`text-base font-bold ${verdictColors[val.verdict] || ''}`}>{val.predicted}</p>
                                <p className="text-[9px] text-muted-foreground">平均: {val.benchmark}</p>
                              </div>
                            );
                          })}
                        </div>

                        {/* Tips */}
                        {r.tips?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold mb-1.5 flex items-center gap-1"><Zap className="w-3 h-3" />この媒体向けの最適化ヒント</p>
                            <ul className="space-y-1">
                              {r.tips.map((tip, i) => (
                                <li key={i} className="text-xs bg-white rounded p-2 border">💡 {tip}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

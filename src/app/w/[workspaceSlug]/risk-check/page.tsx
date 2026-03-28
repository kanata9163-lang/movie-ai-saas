"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/useUser";
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, FileWarning, Type, Eye, Scale } from "lucide-react";

interface RiskCheckProps {
  params: { workspaceSlug: string };
}

interface VideoProject {
  id: string;
  title: string;
  status: string;
}

interface RiskItem {
  severity: 'critical' | 'warning' | 'info' | 'pass';
  category: string;
  message: string;
  detail: string;
  platform?: string;
}

interface RiskResult {
  overallVerdict: 'safe' | 'caution' | 'danger';
  verdictLabel: string;
  verdictDescription: string;
  risks: RiskItem[];
  typos: Array<{ original: string; suggestion: string; context: string }>;
  platformCompliance: Array<{
    platform: string;
    status: 'ok' | 'warning' | 'blocked';
    issues: string[];
  }>;
  legalChecks: Array<{
    item: string;
    status: 'ok' | 'warning' | 'ng';
    detail: string;
  }>;
}

export default function RiskCheckPage({ params }: RiskCheckProps) {
  const { workspaceSlug } = params;
  const { user } = useUser();

  const [inputMode, setInputMode] = useState<'text' | 'project'>('text');
  const [scriptText, setScriptText] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>(["meta", "tiktok", "youtube"]);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<RiskResult | null>(null);

  useEffect(() => {
    fetch(`/api/w/${workspaceSlug}/video-projects`)
      .then(r => r.json())
      .then(res => {
        if (res.ok) setProjects((res.data || []).filter((p: VideoProject) => p.title));
      })
      .catch(() => {});
  }, [workspaceSlug]);

  const handleCheck = async () => {
    if (inputMode === 'text' && !scriptText.trim()) return alert('チェック対象のテキストを入力してください');
    if (inputMode === 'project' && !selectedProjectId) return alert('プロジェクトを選択してください');

    setChecking(true);
    try {
      const res = await fetch(`/api/w/${workspaceSlug}/risk-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: inputMode,
          scriptText: scriptText.trim(),
          projectId: selectedProjectId,
          platforms: targetPlatforms,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setResult(json.data);
      } else {
        alert(json.error || 'チェックに失敗しました');
      }
    } catch {
      alert('チェックに失敗しました');
    } finally {
      setChecking(false);
    }
  };

  const togglePlatform = (p: string) => {
    setTargetPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const verdictColors: Record<string, { bg: string; border: string; text: string; icon: typeof CheckCircle2 }> = {
    safe: { bg: 'bg-green-50', border: 'border-green-500', text: 'text-green-700', icon: CheckCircle2 },
    caution: { bg: 'bg-amber-50', border: 'border-amber-500', text: 'text-amber-700', icon: AlertTriangle },
    danger: { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-700', icon: XCircle },
  };

  const severityStyles: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
    critical: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: XCircle },
    warning: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: AlertTriangle },
    info: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', icon: Eye },
    pass: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', icon: CheckCircle2 },
  };

  return (
    <>
      <Header title="配信リスクチェック" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            <div>
              <h1 className="text-xl font-bold">配信リスクチェック</h1>
              <p className="text-sm text-muted-foreground">広告配信前の最終安全チェック - コンテンツリスク・誤字脱字・媒体ポリシー準拠</p>
            </div>
          </div>

          {/* Input */}
          <div className="rounded-xl border border-border bg-card p-5 mb-6 space-y-4">
            <div className="flex gap-2">
              <button onClick={() => setInputMode('text')} className={`px-4 py-2 text-sm rounded-lg border transition-colors ${inputMode === 'text' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium' : 'border-border hover:bg-muted'}`}>
                テキスト入力
              </button>
              <button onClick={() => setInputMode('project')} className={`px-4 py-2 text-sm rounded-lg border transition-colors ${inputMode === 'project' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium' : 'border-border hover:bg-muted'}`}>
                既存プロジェクトから
              </button>
            </div>

            {inputMode === 'text' ? (
              <textarea
                value={scriptText}
                onChange={e => setScriptText(e.target.value)}
                placeholder="広告テキスト、ナレーション台本、テロップ内容など、チェック対象のテキストを入力してください"
                className="w-full px-4 py-3 text-sm border border-border rounded-lg bg-background resize-none"
                rows={6}
              />
            ) : (
              <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background">
                <option value="">プロジェクトを選択...</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.title || '無題'} ({p.status})</option>
                ))}
              </select>
            )}

            <div>
              <label className="text-sm font-medium block mb-2">配信予定プラットフォーム</label>
              <div className="flex gap-3">
                {[
                  { key: 'meta', label: 'Meta広告' },
                  { key: 'tiktok', label: 'TikTok広告' },
                  { key: 'youtube', label: 'YouTube広告' },
                  { key: 'line', label: 'LINE広告' },
                  { key: 'x', label: 'X（Twitter）広告' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => togglePlatform(key)}
                    className={`px-3 py-2 text-sm rounded-lg border-2 transition-all ${
                      targetPlatforms.includes(key) ? 'border-emerald-400 bg-emerald-50 font-medium' : 'border-border opacity-50 hover:opacity-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleCheck} disabled={checking} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white">
              {checking ? <><Loader2 className="w-4 h-4 animate-spin" />チェック中...</> : <><ShieldCheck className="w-4 h-4" />リスクチェック実行</>}
            </Button>
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-5">
              {/* Overall Verdict */}
              {(() => {
                const vc = verdictColors[result.overallVerdict] || verdictColors.caution;
                const VerdictIcon = vc.icon;
                return (
                  <div className={`rounded-xl border-2 ${vc.border} ${vc.bg} p-6`}>
                    <div className="flex items-center gap-4">
                      <VerdictIcon className={`w-12 h-12 ${vc.text}`} />
                      <div>
                        <p className={`text-2xl font-bold ${vc.text}`}>{result.verdictLabel}</p>
                        <p className="text-sm text-muted-foreground mt-1">{result.verdictDescription}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Platform Compliance */}
              {result.platformCompliance?.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-zinc-500" />
                    媒体ポリシー準拠チェック
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {result.platformCompliance.map((pc, i) => (
                      <div key={i} className={`rounded-lg p-3 border ${
                        pc.status === 'ok' ? 'border-green-200 bg-green-50' :
                        pc.status === 'warning' ? 'border-amber-200 bg-amber-50' :
                        'border-red-200 bg-red-50'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          {pc.status === 'ok' ? <CheckCircle2 className="w-4 h-4 text-green-600" /> :
                           pc.status === 'warning' ? <AlertTriangle className="w-4 h-4 text-amber-600" /> :
                           <XCircle className="w-4 h-4 text-red-600" />}
                          <span className="text-sm font-semibold">{pc.platform}</span>
                        </div>
                        {pc.issues.length > 0 ? (
                          <ul className="space-y-0.5 mt-1">
                            {pc.issues.map((issue, j) => (
                              <li key={j} className="text-xs text-muted-foreground">• {issue}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-green-600">問題なし</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Content Risks */}
              {result.risks?.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                    <FileWarning className="w-4 h-4 text-zinc-500" />
                    コンテンツリスク
                  </h3>
                  <div className="space-y-2">
                    {result.risks.map((risk, i) => {
                      const style = severityStyles[risk.severity] || severityStyles.info;
                      const RiskIcon = style.icon;
                      return (
                        <div key={i} className={`rounded-lg p-3 border ${style.bg}`}>
                          <div className="flex items-start gap-2">
                            <RiskIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${style.text}`} />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold ${style.text}`}>{risk.category}</span>
                                {risk.platform && <span className="text-[10px] bg-white rounded px-1.5 py-0.5 border">{risk.platform}</span>}
                              </div>
                              <p className="text-sm font-medium mt-0.5">{risk.message}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{risk.detail}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Typos */}
              {result.typos?.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                    <Type className="w-4 h-4 text-zinc-500" />
                    誤字脱字チェック
                  </h3>
                  <div className="space-y-2">
                    {result.typos.map((typo, i) => (
                      <div key={i} className="rounded-lg p-3 border border-amber-200 bg-amber-50">
                        <div className="flex items-center gap-3">
                          <span className="text-sm line-through text-red-500">{typo.original}</span>
                          <span className="text-sm">→</span>
                          <span className="text-sm font-medium text-green-700">{typo.suggestion}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">文脈: 「{typo.context}」</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.typos?.length === 0 && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-700 font-medium">誤字脱字は検出されませんでした</span>
                </div>
              )}

              {/* Legal Checks */}
              {result.legalChecks?.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-zinc-500" />
                    法務・コンプライアンスチェック
                  </h3>
                  <div className="space-y-2">
                    {result.legalChecks.map((check, i) => (
                      <div key={i} className={`rounded-lg p-3 border flex items-start gap-2 ${
                        check.status === 'ok' ? 'border-green-200 bg-green-50' :
                        check.status === 'warning' ? 'border-amber-200 bg-amber-50' :
                        'border-red-200 bg-red-50'
                      }`}>
                        {check.status === 'ok' ? <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" /> :
                         check.status === 'warning' ? <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" /> :
                         <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />}
                        <div>
                          <p className="text-sm font-medium">{check.item}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{check.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/useUser";
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, FileWarning, Type, Eye, Scale, Upload, Film, X } from "lucide-react";

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

  const [inputMode, setInputMode] = useState<'video' | 'text' | 'project'>('video');
  const [scriptText, setScriptText] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>(["meta", "tiktok", "youtube"]);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<RiskResult | null>(null);

  // Video upload states
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/w/${workspaceSlug}/video-projects`)
      .then(r => r.json())
      .then(res => {
        if (res.ok) setProjects((res.data || []).filter((p: VideoProject) => p.title));
      })
      .catch(() => {});
  }, [workspaceSlug]);

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setExtractedText("");
    }
  };

  const handleExtractText = async () => {
    if (!videoFile) return;
    setExtracting(true);
    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      const res = await fetch(`/api/w/${workspaceSlug}/extract-video-text`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (json.ok) {
        setExtractedText(json.data.extractedText);
      } else {
        alert(json.error || 'テキスト抽出に失敗しました');
      }
    } catch {
      alert('テキスト抽出に失敗しました');
    } finally {
      setExtracting(false);
    }
  };

  const handleCheck = async () => {
    let contentToCheck = '';
    if (inputMode === 'video') {
      contentToCheck = extractedText.trim();
      if (!contentToCheck) return alert('まず動画からテキストを抽出してください');
    } else if (inputMode === 'text') {
      contentToCheck = scriptText.trim();
      if (!contentToCheck) return alert('チェック対象のテキストを入力してください');
    } else if (inputMode === 'project') {
      if (!selectedProjectId) return alert('プロジェクトを選択してください');
    }

    setChecking(true);
    try {
      const res = await fetch(`/api/w/${workspaceSlug}/risk-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: inputMode === 'video' ? 'text' : inputMode,
          scriptText: inputMode === 'video' ? extractedText.trim() : scriptText.trim(),
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

  const canCheck = inputMode === 'video'
    ? !!extractedText.trim()
    : inputMode === 'text'
      ? !!scriptText.trim()
      : !!selectedProjectId;

  return (
    <>
      <Header title="配信リスクチェック" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            <div>
              <h1 className="text-xl font-bold">配信リスクチェック</h1>
              <p className="text-sm text-muted-foreground">動画ファイルをアップロードして、配信前の安全チェックを実行</p>
            </div>
          </div>

          {/* Input */}
          <div className="rounded-xl border border-border bg-card p-5 mb-6 space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => setInputMode('video')}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors flex items-center gap-1.5 ${inputMode === 'video' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium' : 'border-border hover:bg-muted'}`}
              >
                <Film className="w-3.5 h-3.5" />
                動画アップロード
              </button>
              <button onClick={() => setInputMode('text')} className={`px-4 py-2 text-sm rounded-lg border transition-colors ${inputMode === 'text' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium' : 'border-border hover:bg-muted'}`}>
                テキスト入力
              </button>
              <button onClick={() => setInputMode('project')} className={`px-4 py-2 text-sm rounded-lg border transition-colors ${inputMode === 'project' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium' : 'border-border hover:bg-muted'}`}>
                既存プロジェクトから
              </button>
            </div>

            {inputMode === 'video' ? (
              <div className="space-y-3">
                {!videoFile ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-emerald-300 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 transition-all"
                  >
                    <Upload className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-zinc-700">動画ファイルをクリックして選択</p>
                    <p className="text-xs text-muted-foreground mt-1">MP4, MOV, WebM, AVI（最大100MB）</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm,video/avi,video/x-msvideo"
                      onChange={handleVideoSelect}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Film className="w-5 h-5 text-emerald-600" />
                        <div>
                          <p className="text-sm font-medium">{videoFile.name}</p>
                          <p className="text-xs text-muted-foreground">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>
                        </div>
                      </div>
                      <button
                        onClick={() => { setVideoFile(null); setExtractedText(""); }}
                        className="p-1 rounded hover:bg-emerald-100"
                      >
                        <X className="w-4 h-4 text-zinc-500" />
                      </button>
                    </div>

                    {!extractedText && (
                      <Button
                        onClick={handleExtractText}
                        disabled={extracting}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {extracting ? (
                          <><Loader2 className="w-4 h-4 animate-spin" />動画を解析中...（音声・テロップを抽出しています）</>
                        ) : (
                          <><Upload className="w-4 h-4" />動画からテキストを抽出</>
                        )}
                      </Button>
                    )}
                  </div>
                )}

                {extractedText && (
                  <div>
                    <label className="text-sm font-medium block mb-1.5">抽出されたテキスト（編集可能）</label>
                    <textarea
                      value={extractedText}
                      onChange={e => setExtractedText(e.target.value)}
                      className="w-full px-4 py-3 text-sm border border-border rounded-lg bg-background resize-none font-mono"
                      rows={10}
                    />
                    <p className="text-xs text-muted-foreground mt-1">※ AI が抽出したテキストです。必要に応じて編集してください。</p>
                  </div>
                )}
              </div>
            ) : inputMode === 'text' ? (
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
              <div className="flex gap-3 flex-wrap">
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

            <Button onClick={handleCheck} disabled={checking || !canCheck} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white">
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

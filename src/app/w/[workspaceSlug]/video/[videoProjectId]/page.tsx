"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/useUser";
import LoadingAnimation from "@/components/LoadingAnimation";
import ImageLightbox from "@/components/ImageLightbox";
import { STAGE_LABELS, PipelineStage } from "@/lib/video/pipeline/types";
import {
  ChevronLeft,
  Loader2,
  Play,
  RefreshCw,
  Wand2,
  Maximize2,
  Volume2,
  Check,
  AlertCircle,
  Download,
  Film,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import ShareButton from "@/components/ShareButton";

interface VideoDetailProps {
  params: { workspaceSlug: string; videoProjectId: string };
}

interface Scene {
  id: string;
  scene_number: number;
  description: string;
  image_prompt: string;
  narration_text: string;
  duration: number;
  image_url: string | null;
  video_url: string | null;
  audio_url: string | null;
  status: string;
}

interface VideoProject {
  id: string;
  title: string;
  status: string;
  source_url: string;
  aspect_ratio: string;
  voice_type: string;
  script: { title: string; scenes: unknown[] } | null;
  pipeline_logs: string[];
  error_message: string | null;
  scenes: Scene[];
}

// Map pipeline stages to wizard steps for the step indicator
const WIZARD_STEPS = [
  { key: 'analyze', label: 'URL解析・台本生成', stages: ['pending', 'analyzing', 'scripting', 'script_ready'] },
  { key: 'images', label: '画像生成', stages: ['generating_images', 'images_ready'] },
  { key: 'video', label: '動画生成', stages: ['generating_video'] },
  { key: 'audio', label: 'ナレーション・完成', stages: ['generating_audio', 'composing', 'completed'] },
];

function getWizardStep(status: string): number {
  for (let i = 0; i < WIZARD_STEPS.length; i++) {
    if (WIZARD_STEPS[i].stages.includes(status)) return i;
  }
  return 0;
}

export default function VideoDetailPage({ params }: VideoDetailProps) {
  const { workspaceSlug, videoProjectId } = params;
  const { user } = useUser();
  const router = useRouter();

  const [project, setProject] = useState<VideoProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const [composeProgress, setComposeProgress] = useState("");
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const loadProject = async () => {
    const res = await fetch(`/api/w/${workspaceSlug}/video-projects/${videoProjectId}`);
    const { data } = await res.json();
    setProject(data);
    setLoading(false);
  };

  useEffect(() => {
    loadProject();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  useEffect(() => {
    if (logsEndRef.current && showLogs) logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [project?.pipeline_logs, showLogs]);

  useEffect(() => {
    if (project?.status === 'generating_video') {
      pollingRef.current = setInterval(async () => {
        const res = await fetch(`/api/w/${workspaceSlug}/video-projects/${videoProjectId}/check-video`);
        const result = await res.json();
        await loadProject();
        if (result.allDone) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          // Auto-trigger narration generation after all videos complete
          try {
            await fetch(`/api/w/${workspaceSlug}/video-projects/${videoProjectId}/generate-audio`, { method: 'POST' });
            await loadProject();
          } catch { /* ignore */ }
        }
      }, 10000);
      return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
    }
  }, [project?.status]);

  const runAction = async (endpoint: string, method = 'POST') => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/w/${workspaceSlug}/video-projects/${videoProjectId}/${endpoint}`, { method });
      const result = await res.json();
      await loadProject();

      if (endpoint === 'generate-images' && result.ok && !result.allDone) {
        let allDone = false;
        while (!allDone) {
          const r = await fetch(`/api/w/${workspaceSlug}/video-projects/${videoProjectId}/generate-images`, { method: 'POST' });
          const d = await r.json();
          await loadProject();
          allDone = d.allDone;
        }
      }
    } catch (e) {
      alert(`エラー: ${e instanceof Error ? e.message : ''}`);
    } finally {
      setActionLoading(false);
    }
  };

  const regenerateImage = async (sceneId: string) => {
    setActionLoading(true);
    try {
      await fetch(`/api/w/${workspaceSlug}/video-projects/${videoProjectId}/regenerate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneId }),
      });
      await loadProject();
    } catch { /* ignore */ }
    finally { setActionLoading(false); }
  };

  const proxyUrl = (sceneId: string, type: 'video' | 'audio' = 'video') =>
    `/api/w/${workspaceSlug}/video-projects/${videoProjectId}/download-video?sceneId=${sceneId}&type=${type}`;

  const handleCompose = async () => {
    if (!project) return;
    const scenesWithVideo = project.scenes.filter(s => s.video_url).sort((a, b) => a.scene_number - b.scene_number);
    if (scenesWithVideo.length === 0) return alert("動画がありません");

    setComposing(true);

    try {
      setComposeProgress("FFmpegを読み込み中...");
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const ffmpeg = new FFmpeg();
      ffmpeg.on("log", ({ message }: { message: string }) => console.log("[ffmpeg]", message));
      ffmpeg.on("progress", ({ progress }: { progress: number }) => {
        if (progress > 0) setComposeProgress(`処理中... ${Math.round(progress * 100)}%`);
      });

      // Load single-threaded core (no SharedArrayBuffer needed)
      setComposeProgress("FFmpeg WASM をダウンロード中（初回のみ）...");
      const coreBase = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      await ffmpeg.load({
        coreURL: coreBase + "/ffmpeg-core.js",
        wasmURL: coreBase + "/ffmpeg-core.wasm",
      });

      // Download videos via proxy
      const fileNames: string[] = [];
      for (let i = 0; i < scenesWithVideo.length; i++) {
        const scene = scenesWithVideo[i];
        setComposeProgress(`シーン${scene.scene_number} 動画DL中... (${i + 1}/${scenesWithVideo.length})`);
        const resp = await fetch(proxyUrl(scene.id));
        if (!resp.ok) throw new Error(`シーン${scene.scene_number}のDL失敗`);
        const buf = await resp.arrayBuffer();
        const videoName = `v${i}.mp4`;
        await ffmpeg.writeFile(videoName, new Uint8Array(buf));

        // Download audio if available
        if (scene.audio_url) {
          setComposeProgress(`シーン${scene.scene_number} 音声DL中...`);
          const audioResp = await fetch(proxyUrl(scene.id, 'audio'));
          if (audioResp.ok) {
            const audioBuf = await audioResp.arrayBuffer();
            const audioName = `a${i}.mp3`;
            await ffmpeg.writeFile(audioName, new Uint8Array(audioBuf));

            // Merge video + audio for this scene
            setComposeProgress(`シーン${scene.scene_number} 動画+音声合成中...`);
            const mergedName = `m${i}.mp4`;
            await ffmpeg.exec([
              "-i", videoName, "-i", audioName,
              "-c:v", "copy", "-c:a", "aac", "-shortest",
              mergedName
            ]);
            fileNames.push(mergedName);
          } else {
            fileNames.push(videoName);
          }
        } else {
          fileNames.push(videoName);
        }
      }

      // Concatenate all scenes
      setComposeProgress("全シーンを結合中...");
      const concatList = fileNames.map(n => `file '${n}'`).join("\n");
      await ffmpeg.writeFile("filelist.txt", concatList);
      await ffmpeg.exec([
        "-f", "concat", "-safe", "0", "-i", "filelist.txt",
        "-c", "copy", "output.mp4"
      ]);

      const data = await ffmpeg.readFile("output.mp4");
      const blob = new Blob([new Uint8Array(data as unknown as ArrayBuffer)], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      setFinalVideoUrl(url);
      setComposeProgress("完了！");

      // Cleanup
      for (const name of fileNames) await ffmpeg.deleteFile(name).catch(() => {});
      await ffmpeg.deleteFile("filelist.txt").catch(() => {});
      await ffmpeg.deleteFile("output.mp4").catch(() => {});
    } catch (e) {
      console.error("Compose error:", e);
      alert("動画結合に失敗しました: " + (e instanceof Error ? e.message : String(e)));
      setComposeProgress("");
    } finally {
      setComposing(false);
    }
  };

  const handleDownloadAll = async () => {
    if (!project) return;
    const scenesWithVideo = project.scenes.filter(s => s.video_url).sort((a, b) => a.scene_number - b.scene_number);
    for (const scene of scenesWithVideo) {
      const a = document.createElement("a");
      a.href = proxyUrl(scene.id);
      a.download = `${project.title || "video"}_scene${scene.scene_number}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      await new Promise(r => setTimeout(r, 500));
      // Also download audio if available
      if (scene.audio_url) {
        const a2 = document.createElement("a");
        a2.href = proxyUrl(scene.id, 'audio');
        a2.download = `${project.title || "video"}_scene${scene.scene_number}_narration.mp3`;
        document.body.appendChild(a2);
        a2.click();
        document.body.removeChild(a2);
        await new Promise(r => setTimeout(r, 500));
      }
    }
  };

  if (loading || !project) {
    return (
      <>
        <Header title="動画プロジェクト" userEmail={user?.email} />
        <main className="flex-1 flex items-center justify-center">
          <LoadingAnimation message="読み込み中..." />
        </main>
      </>
    );
  }

  const currentStep = getWizardStep(project.status);
  const isCompleted = project.status === 'completed';
  const scenesWithImages = project.scenes.filter(s => s.image_url);

  return (
    <>
      <Header title="動画プロジェクト" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Back + Title */}
          <button
            onClick={() => router.push(`/w/${workspaceSlug}/video`)}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
          >
            <ChevronLeft className="w-4 h-4" />一覧に戻る
          </button>

          <h1 className="text-xl font-bold mb-1">{project.title || '無題'}</h1>
          <p className="text-sm text-muted-foreground mb-8">
            {project.source_url} / {project.aspect_ratio} / {project.voice_type === 'female' ? '女性' : '男性'}ナレーション / {project.scenes.length}シーン
          </p>

          {/* Step Indicator (storyboard style) */}
          <div className="flex items-center justify-center mb-10">
            {WIZARD_STEPS.map((step, idx) => {
              const done = isCompleted || currentStep > idx;
              const active = !isCompleted && currentStep === idx;
              return (
                <div key={step.key} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
                      ${done ? 'bg-white border-zinc-400 text-zinc-500' : active ? 'bg-white border-zinc-900 text-zinc-900' : 'bg-zinc-100 border-zinc-200 text-zinc-400'}`}>
                      {done ? <Check className="w-4 h-4" /> : idx + 1}
                    </div>
                    <span className={`text-[11px] mt-1.5 whitespace-nowrap ${active ? 'font-bold text-zinc-900' : done ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      {step.label}
                    </span>
                  </div>
                  {idx < WIZARD_STEPS.length - 1 && (
                    <div className={`w-16 sm:w-24 h-0.5 mx-2 mt-[-16px] ${done ? 'bg-zinc-400' : 'bg-zinc-200'}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Error */}
          {project.status === 'failed' && project.error_message && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{project.error_message}</p>
            </div>
          )}

          {/* Status-specific message + action */}
          <div className="mb-8">
            {project.status === 'generating_video' && (
              <div className="flex items-center justify-center gap-2 text-sm text-blue-600 p-4 rounded-lg bg-blue-50 border border-blue-200">
                <Loader2 className="w-4 h-4 animate-spin" />
                動画生成中... 10秒ごとに自動チェックしています
              </div>
            )}
            {(project.status === 'analyzing' || project.status === 'scripting') && (
              <div className="flex items-center justify-center gap-2 text-sm text-blue-600 p-4 rounded-lg bg-blue-50 border border-blue-200">
                <Loader2 className="w-4 h-4 animate-spin" />
                {STAGE_LABELS[project.status as PipelineStage]}...
              </div>
            )}
            {project.status === 'generating_images' && (
              <div className="flex items-center justify-center gap-2 text-sm text-blue-600 p-4 rounded-lg bg-blue-50 border border-blue-200">
                <Loader2 className="w-4 h-4 animate-spin" />
                画像生成中...
              </div>
            )}
            {project.status === 'generating_audio' && (
              <div className="flex items-center justify-center gap-2 text-sm text-blue-600 p-4 rounded-lg bg-blue-50 border border-blue-200">
                <Loader2 className="w-4 h-4 animate-spin" />
                ナレーション生成中...
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mb-8 justify-center">
            {(project.status === 'pending' || project.status === 'failed') && (
              <Button onClick={() => runAction('analyze')} disabled={actionLoading} className="bg-zinc-900 text-white h-11 px-6">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                URL解析 & 台本生成
              </Button>
            )}
            {project.status === 'script_ready' && (
              <Button onClick={() => runAction('generate-images')} disabled={actionLoading} className="bg-zinc-900 text-white h-11 px-6">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                画像を生成
              </Button>
            )}
            {project.status === 'images_ready' && (
              <>
                <Button onClick={() => runAction('generate-video')} disabled={actionLoading} className="bg-zinc-900 text-white h-11 px-6">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  動画を生成（Runway AI）
                </Button>
                <Button onClick={() => runAction('generate-audio')} disabled={actionLoading} variant="outline" className="h-11 px-6">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                  ナレーション生成
                </Button>
              </>
            )}
            {project.scenes.some(s => s.video_url) && !project.scenes.some(s => s.audio_url) && project.status !== 'generating_audio' && (
              <Button onClick={() => runAction('generate-audio')} disabled={actionLoading} className="bg-orange-600 text-white hover:bg-orange-700 h-11 px-6">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                ナレーション生成
              </Button>
            )}
            {project.scenes.some(s => s.video_url) && (
              <>
                <Button onClick={handleCompose} disabled={composing} className="bg-green-600 text-white hover:bg-green-700 h-11 px-6">
                  {composing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
                  動画を結合してダウンロード
                </Button>
                <Button onClick={handleDownloadAll} variant="outline" className="h-11 px-6">
                  <Download className="w-4 h-4" />
                  個別ダウンロード
                </Button>
              </>
            )}
            {composing && composeProgress && (
              <span className="text-sm text-blue-600 self-center">{composeProgress}</span>
            )}
          </div>

          {/* Final composed video */}
          {finalVideoUrl && (
            <div className="rounded-xl border-2 border-green-500 bg-green-50 p-6 mb-8">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                最終動画
              </h3>
              <video src={finalVideoUrl} controls className="w-full max-w-lg mx-auto rounded-lg shadow-lg" />
              <div className="flex justify-center gap-2 mt-4">
                <a href={finalVideoUrl} download={(project.title || "video") + ".mp4"}>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4" />MP4をダウンロード
                  </Button>
                </a>
                <ShareButton title={project.title || "動画"} text="動画プロジェクトを共有" />
              </div>
            </div>
          )}

          {/* Scene Cards - Horizontal Scroll (storyboard style) */}
          {project.scenes.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-bold mb-4">シーンごとの詳細</h2>
              <div className="overflow-x-auto -mx-2">
                <div className="flex gap-4 pb-4 px-2" style={{ minWidth: "max-content" }}>
                  {project.scenes
                    .sort((a, b) => a.scene_number - b.scene_number)
                    .map((scene) => (
                    <div key={scene.id} className="w-72 flex-shrink-0 rounded-lg border border-border overflow-hidden bg-white">
                      {/* Scene Image / Video */}
                      <div className="relative aspect-video bg-zinc-100 flex items-center justify-center">
                        {scene.image_url ? (
                          <div
                            className="relative w-full h-full group cursor-pointer"
                            onClick={() => {
                              const idx = scenesWithImages.findIndex(s => s.id === scene.id);
                              if (idx >= 0) setLightboxIndex(idx);
                            }}
                          >
                            <img src={scene.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                              <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400">画像なし</span>
                        )}
                        {/* Scene number badge */}
                        <div className="absolute top-2 left-2 bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                          {scene.scene_number}
                        </div>
                        {/* Duration badge */}
                        <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                          {Math.round(Number(scene.duration))}秒
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-3 space-y-2">
                        {/* Video player */}
                        {scene.video_url && (
                          <div>
                            <label className="text-[10px] font-medium text-muted-foreground block mb-1">動画</label>
                            <video src={scene.video_url} controls className="w-full rounded" />
                          </div>
                        )}

                        {/* Audio player */}
                        {scene.audio_url && (
                          <div>
                            <label className="text-[10px] font-medium text-muted-foreground block mb-1">ナレーション</label>
                            <audio src={scene.audio_url} controls className="w-full h-8" />
                          </div>
                        )}

                        {/* Narration text */}
                        {scene.narration_text && (
                          <div>
                            <label className="text-[10px] font-medium text-muted-foreground block mb-1">セリフ</label>
                            <p className="text-xs leading-relaxed bg-zinc-50 rounded p-2 border border-border">
                              {scene.narration_text}
                            </p>
                          </div>
                        )}

                        {/* Description */}
                        {scene.description && (
                          <div>
                            <label className="text-[10px] font-medium text-muted-foreground block mb-1">シーン説明</label>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              {scene.description}
                            </p>
                          </div>
                        )}

                        {/* Image Prompt */}
                        {scene.image_prompt && (
                          <div>
                            <label className="text-[10px] font-medium text-muted-foreground block mb-1">プロンプト</label>
                            <p className="text-[10px] text-muted-foreground bg-zinc-50 rounded p-2 border border-border leading-relaxed">
                              {scene.image_prompt}
                            </p>
                          </div>
                        )}

                        {/* Regenerate button */}
                        {(project.status === 'images_ready' || project.status === 'script_ready') && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs mt-1"
                            onClick={() => regenerateImage(scene.id)}
                            disabled={actionLoading}
                          >
                            <RefreshCw className="w-3 h-3" />画像を再生成
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Logs (collapsible) */}
          <div className="mb-8">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="flex items-center gap-2 text-sm font-bold text-zinc-700 hover:text-zinc-900 mb-2"
            >
              {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              パイプラインログ
              {(project.pipeline_logs || []).length > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  ({(project.pipeline_logs || []).length}件)
                </span>
              )}
            </button>
            {showLogs && (
              <div className="rounded-xl border border-border p-4 max-h-[400px] overflow-y-auto bg-zinc-950 text-green-400">
                {(project.pipeline_logs || []).length === 0 ? (
                  <p className="text-xs text-zinc-600">ログなし</p>
                ) : (
                  <div className="space-y-0.5">
                    {(project.pipeline_logs || []).map((log, i) => (
                      <p key={i} className="text-[11px] font-mono leading-relaxed">{log}</p>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Lightbox */}
      {lightboxIndex !== null && scenesWithImages[lightboxIndex] && (
        <ImageLightbox
          src={scenesWithImages[lightboxIndex].image_url!}
          alt={`シーン ${scenesWithImages[lightboxIndex].scene_number}`}
          onClose={() => setLightboxIndex(null)}
          hasPrev={lightboxIndex > 0}
          hasNext={lightboxIndex < scenesWithImages.length - 1}
          onPrev={() => setLightboxIndex(i => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() => setLightboxIndex(i => (i !== null && i < scenesWithImages.length - 1 ? i + 1 : i))}
        />
      )}
    </>
  );
}

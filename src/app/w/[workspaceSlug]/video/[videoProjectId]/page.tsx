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
  Pencil,
  Save,
  RotateCcw,
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
  { key: 'audio', label: 'ナレーション生成', stages: ['generating_audio'] },
  { key: 'video', label: '動画生成・完成', stages: ['generating_video', 'composing', 'completed'] },
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
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{ narration_text: string; description: string; image_prompt: string; duration: number }>({ narration_text: '', description: '', image_prompt: '', duration: 5 });
  const [savingScene, setSavingScene] = useState(false);
  const [regeneratingScript, setRegeneratingScript] = useState(false);
  const [regeneratingVideoSceneId, setRegeneratingVideoSceneId] = useState<string | null>(null);
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
          await loadProject();
          // If audio was already generated (new flow), mark as completed
          // If not (old flow), auto-trigger narration
          const projRes = await fetch(`/api/w/${workspaceSlug}/video-projects/${videoProjectId}`);
          const projData = await projRes.json();
          const hasAudio = projData.data?.scenes?.some((s: { audio_url: string | null }) => s.audio_url);
          if (hasAudio) {
            // New flow: audio was done first, now mark completed
            await fetch(`/api/w/${workspaceSlug}/video-projects/${videoProjectId}/complete`, { method: 'POST' });
          } else {
            // Old flow: generate audio after video
            await fetch(`/api/w/${workspaceSlug}/video-projects/${videoProjectId}/generate-audio`, { method: 'POST' });
          }
          await loadProject();
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

  const startEditing = (scene: Scene) => {
    setEditingSceneId(scene.id);
    setEditFields({
      narration_text: scene.narration_text || '',
      description: scene.description || '',
      image_prompt: scene.image_prompt || '',
      duration: scene.duration || 5,
    });
  };

  const saveScene = async () => {
    if (!editingSceneId) return;
    setSavingScene(true);
    try {
      await fetch(`/api/w/${workspaceSlug}/video-projects/${videoProjectId}/scenes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneId: editingSceneId, ...editFields }),
      });
      setEditingSceneId(null);
      await loadProject();
    } catch { alert('保存に失敗しました'); }
    finally { setSavingScene(false); }
  };

  const regenerateScript = async () => {
    if (!confirm('台本を再生成しますか？現在のシーンは全て削除されます。')) return;
    setRegeneratingScript(true);
    try {
      await fetch(`/api/w/${workspaceSlug}/video-projects/${videoProjectId}/scenes`, { method: 'POST' });
      await loadProject();
      // Auto-run analyze
      await runAction('analyze');
    } catch { alert('再生成に失敗しました'); }
    finally { setRegeneratingScript(false); }
  };

  const regenerateVideo = async (sceneId: string) => {
    setRegeneratingVideoSceneId(sceneId);
    try {
      const res = await fetch(`/api/w/${workspaceSlug}/video-projects/${videoProjectId}/regenerate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneId }),
      });
      const result = await res.json();
      if (!res.ok) {
        alert(`動画再生成に失敗: ${result.error || '不明なエラー'}`);
      }
      await loadProject();
    } catch {
      alert('動画再生成に失敗しました');
    } finally {
      setRegeneratingVideoSceneId(null);
    }
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
            // Use -stream_loop to loop video if audio is longer, then cut to audio length
            setComposeProgress(`シーン${scene.scene_number} 動画+音声合成中...`);
            const mergedName = `m${i}.mp4`;
            await ffmpeg.exec([
              "-stream_loop", "-1", "-i", videoName,
              "-i", audioName,
              "-c:v", "libx264", "-preset", "ultrafast",
              "-c:a", "aac",
              "-shortest",
              "-fflags", "+shortest",
              "-max_interleave_delta", "100M",
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

  // When failed, determine the actual progress from scene data
  const failedStep = (() => {
    if (project.status !== 'failed') return -1;
    const hasScenes = project.scenes.length > 0;
    const hasImages = project.scenes.some(s => s.image_url);
    const hasAudio = project.scenes.some(s => s.audio_url);
    if (hasAudio) return 3; // failed at video generation
    if (hasImages) return 2; // failed at audio generation
    if (hasScenes) return 1; // failed at image generation
    return 0; // failed at analysis
  })();
  const currentStep = project.status === 'failed' ? failedStep : getWizardStep(project.status);
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
              const isFailed = project.status === 'failed' && currentStep === idx;
              return (
                <div key={step.key} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
                      ${isFailed ? 'bg-red-50 border-red-500 text-red-600' : done ? 'bg-white border-zinc-400 text-zinc-500' : active ? 'bg-white border-zinc-900 text-zinc-900' : 'bg-zinc-100 border-zinc-200 text-zinc-400'}`}>
                      {isFailed ? <AlertCircle className="w-4 h-4" /> : done ? <Check className="w-4 h-4" /> : idx + 1}
                    </div>
                    <span className={`text-[11px] mt-1.5 whitespace-nowrap ${isFailed ? 'font-bold text-red-600' : active ? 'font-bold text-zinc-900' : done ? 'text-zinc-500' : 'text-zinc-400'}`}>
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
            {(() => {
              // Determine the best recovery action based on actual scene data
              const hasScenes = project.scenes.length > 0;
              const hasImages = project.scenes.some(s => s.image_url);
              const hasAudio = project.scenes.some(s => s.audio_url);
              const hasVideo = project.scenes.some(s => s.video_url);
              const isFailed = project.status === 'failed';

              return (
                <>
                  {/* Pending: start from scratch */}
                  {project.status === 'pending' && (
                    <Button onClick={() => runAction('analyze')} disabled={actionLoading} className="bg-zinc-900 text-white h-11 px-6">
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                      URL解析 & 台本生成
                    </Button>
                  )}

                  {/* Failed: show smart recovery buttons based on what data exists */}
                  {isFailed && !hasScenes && (
                    <Button onClick={() => runAction('analyze')} disabled={actionLoading} className="bg-zinc-900 text-white h-11 px-6">
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                      URL解析 & 台本生成（リトライ）
                    </Button>
                  )}
                  {isFailed && hasScenes && !hasImages && (
                    <Button onClick={() => runAction('generate-images')} disabled={actionLoading} className="bg-zinc-900 text-white h-11 px-6">
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                      画像を生成（リトライ）
                    </Button>
                  )}
                  {isFailed && hasImages && !hasAudio && (
                    <Button onClick={() => runAction('generate-audio')} disabled={actionLoading} className="bg-zinc-900 text-white h-11 px-6">
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                      ナレーション生成（リトライ）
                    </Button>
                  )}
                  {isFailed && hasImages && hasAudio && !hasVideo && (
                    <Button onClick={() => runAction('generate-video')} disabled={actionLoading} className="bg-zinc-900 text-white h-11 px-6">
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      動画を生成（リトライ）
                    </Button>
                  )}
                  {isFailed && hasVideo && (
                    <Button onClick={() => runAction('generate-video')} disabled={actionLoading} className="bg-zinc-900 text-white h-11 px-6">
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      動画を再生成
                    </Button>
                  )}

                  {/* Script ready */}
                  {project.status === 'script_ready' && (
                    <>
                      <Button onClick={() => runAction('generate-images')} disabled={actionLoading} className="bg-zinc-900 text-white h-11 px-6">
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                        画像を生成
                      </Button>
                      <Button onClick={regenerateScript} disabled={regeneratingScript || actionLoading} variant="outline" className="h-11 px-6">
                        {regeneratingScript ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                        台本を再生成
                      </Button>
                    </>
                  )}

                  {/* Images ready: generate audio or video */}
                  {project.status === 'images_ready' && !hasAudio && (
                    <Button onClick={() => runAction('generate-audio')} disabled={actionLoading} className="bg-zinc-900 text-white h-11 px-6">
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                      ナレーション生成（音声の長さで動画時間を自動調整）
                    </Button>
                  )}
                  {project.status === 'images_ready' && hasAudio && (
                    <Button onClick={() => runAction('generate-video')} disabled={actionLoading} className="bg-zinc-900 text-white h-11 px-6">
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      動画を生成（Runway AI）
                    </Button>
                  )}
                </>
              );
            })()}
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

                        {editingSceneId === scene.id ? (
                          /* Edit mode */
                          <div className="space-y-2">
                            <div>
                              <label className="text-[10px] font-medium text-muted-foreground block mb-1">セリフ</label>
                              <textarea
                                value={editFields.narration_text}
                                onChange={e => setEditFields(f => ({ ...f, narration_text: e.target.value }))}
                                className="w-full text-xs p-2 border border-blue-300 rounded bg-blue-50 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                                rows={3}
                              />
                              <p className="text-[9px] text-muted-foreground mt-0.5">{editFields.narration_text.length}文字（推奨: {editFields.duration <= 5 ? 20 : 40}文字以内）</p>
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-muted-foreground block mb-1">シーン説明</label>
                              <textarea
                                value={editFields.description}
                                onChange={e => setEditFields(f => ({ ...f, description: e.target.value }))}
                                className="w-full text-[11px] p-2 border border-border rounded resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                                rows={3}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-muted-foreground block mb-1">画像プロンプト</label>
                              <textarea
                                value={editFields.image_prompt}
                                onChange={e => setEditFields(f => ({ ...f, image_prompt: e.target.value }))}
                                className="w-full text-[10px] p-2 border border-border rounded resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                                rows={3}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" className="flex-1 text-xs h-7" onClick={saveScene} disabled={savingScene}>
                                {savingScene ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                保存
                              </Button>
                              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setEditingSceneId(null)}>
                                キャンセル
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* View mode */
                          <>
                            {scene.narration_text && (
                              <div>
                                <label className="text-[10px] font-medium text-muted-foreground block mb-1">セリフ</label>
                                <p className="text-xs leading-relaxed bg-zinc-50 rounded p-2 border border-border">
                                  {scene.narration_text}
                                </p>
                              </div>
                            )}

                            {scene.description && (
                              <div>
                                <label className="text-[10px] font-medium text-muted-foreground block mb-1">シーン説明</label>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                  {scene.description}
                                </p>
                              </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {(project.status === 'script_ready' || project.status === 'images_ready') && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 text-[10px] h-7"
                                  onClick={() => startEditing(scene)}
                                >
                                  <Pencil className="w-3 h-3" />編集
                                </Button>
                              )}
                              {(project.status === 'images_ready' || project.status === 'script_ready') && scene.image_url && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 text-[10px] h-7"
                                  onClick={() => regenerateImage(scene.id)}
                                  disabled={actionLoading}
                                >
                                  <RefreshCw className="w-3 h-3" />画像再生成
                                </Button>
                              )}
                              {/* Video regeneration for failed or completed scenes */}
                              {scene.image_url && (scene.status === 'video_failed' || scene.status === 'video_ready') && (
                                <Button
                                  variant={scene.status === 'video_failed' ? 'default' : 'outline'}
                                  size="sm"
                                  className={`flex-1 text-[10px] h-7 ${scene.status === 'video_failed' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`}
                                  onClick={() => regenerateVideo(scene.id)}
                                  disabled={regeneratingVideoSceneId === scene.id}
                                >
                                  {regeneratingVideoSceneId === scene.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                  動画再生成
                                </Button>
                              )}
                            </div>
                            {/* Failed indicator */}
                            {scene.status === 'video_failed' && (
                              <div className="flex items-center gap-1 text-[10px] text-red-600 mt-1">
                                <AlertCircle className="w-3 h-3" />
                                動画生成に失敗しました
                              </div>
                            )}
                          </>
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

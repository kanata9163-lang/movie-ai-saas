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
  Music,
  BookOpen,
  Quote,
  TrendingUp,
  Package,
} from "lucide-react";
import ShareButton from "@/components/ShareButton";

interface VideoDetailProps {
  params: { workspaceSlug: string; videoProjectId: string };
}

interface SubtitleStyle {
  fontSize: number;
  fontColor: string;
  bgColor: string;
  position: 'top' | 'center' | 'bottom';
  fontWeight: string;
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
  subtitle_text: string | null;
  subtitle_style: SubtitleStyle | null;
}

interface AdMetric {
  predicted: string;
  benchmark: string;
  verdict: string;
}

interface CompetitorInsight {
  insight: string;
  source: string;
}

interface PredictionSource {
  title?: string;
  url: string;
}

interface AdPrediction {
  overallScore: number;
  scoreLabel: string;
  metrics: Record<string, AdMetric>;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  competitorInsights: CompetitorInsight[];
  sources: PredictionSource[];
}

interface VideoProject {
  id: string;
  title: string;
  status: string;
  source_url: string;
  aspect_ratio: string;
  voice_type: string;
  voice_style: string;
  custom_instructions: string;
  script: { title: string; scenes: unknown[] } | null;
  pipeline_logs: string[];
  error_message: string | null;
  ad_prediction: AdPrediction | null;
  scenes: Scene[];
  company_analysis: {
    companyName?: string;
    industry?: string;
    products?: string[];
    targetAudience?: string;
    tone?: string;
    keyMessages?: string[];
    description?: string;
    citations?: Array<{ fact: string; source: string; context?: string }>;
    marketInsights?: Array<{ insight: string; basis: string }>;
  } | null;
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
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{
    narration_text: string;
    description: string;
    image_prompt: string;
    duration: number;
    subtitle_text: string;
    subtitle_style: { fontSize: number; fontColor: string; bgColor: string; position: string; fontWeight: string };
  }>({
    narration_text: '',
    description: '',
    image_prompt: '',
    duration: 5,
    subtitle_text: '',
    subtitle_style: { fontSize: 36, fontColor: '#FFFFFF', bgColor: 'rgba(0,0,0,0.7)', position: 'bottom', fontWeight: 'bold' },
  });
  const [savingScene, setSavingScene] = useState(false);
  const [regeneratingScript, setRegeneratingScript] = useState(false);
  const [regeneratingVideoSceneId, setRegeneratingVideoSceneId] = useState<string | null>(null);
  const [regeneratingAudioSceneId, setRegeneratingAudioSceneId] = useState<string | null>(null);
  const [generatingBGM, setGeneratingBGM] = useState(false);
  const [bgmUrl, setBgmUrl] = useState<string | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<AdPrediction | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const loadProject = async () => {
    const res = await fetch(`/api/w/${workspaceSlug}/video-projects/${videoProjectId}`);
    const { data } = await res.json();
    setProject(data);
    if (data?.ad_prediction) setPrediction(data.ad_prediction);
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
      subtitle_text: scene.subtitle_text || scene.narration_text || '',
      subtitle_style: scene.subtitle_style || { fontSize: 36, fontColor: '#FFFFFF', bgColor: 'rgba(0,0,0,0.7)', position: 'bottom', fontWeight: 'bold' },
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

  const regenerateAudio = async (sceneId: string) => {
    setRegeneratingAudioSceneId(sceneId);
    try {
      const res = await fetch(`/api/w/${workspaceSlug}/video-projects/${videoProjectId}/regenerate-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneId }),
      });
      const result = await res.json();
      if (!res.ok) {
        alert(`音声再生成に失敗: ${result.error || '不明なエラー'}`);
      }
      await loadProject();
    } catch {
      alert('音声再生成に失敗しました');
    } finally {
      setRegeneratingAudioSceneId(null);
    }
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

  const createSubtitleImage = async (
    text: string,
    width: number,
    height: number,
    style: { fontSize: number; fontColor: string; bgColor: string; position: string; fontWeight: string }
  ): Promise<Uint8Array> => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);
    const fontSize = style.fontSize || 36;
    ctx.font = `${style.fontWeight || 'bold'} ${fontSize}px "Hiragino Sans", "Noto Sans JP", sans-serif`;
    ctx.textAlign = 'center';
    const maxWidth = width - 40;
    const lines: string[] = [];
    let currentLine = '';
    for (const char of text) {
      const testLine = currentLine + char;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    const lineHeight = fontSize * 1.4;
    const totalHeight = lines.length * lineHeight;
    let startY: number;
    if (style.position === 'top') {
      startY = 40 + fontSize;
    } else if (style.position === 'center') {
      startY = (height - totalHeight) / 2 + fontSize;
    } else {
      startY = height - totalHeight - 30;
    }
    if (style.bgColor && style.bgColor !== 'none') {
      const padding = 12;
      const bgWidth = Math.min(maxWidth + padding * 2, width);
      const bgX = (width - bgWidth) / 2;
      const bgY = startY - fontSize - padding / 2;
      const bgH = totalHeight + padding;
      ctx.fillStyle = style.bgColor;
      ctx.beginPath();
      ctx.roundRect(bgX, bgY, bgWidth, bgH, 8);
      ctx.fill();
    }
    for (let i = 0; i < lines.length; i++) {
      const y = startY + i * lineHeight;
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 4;
      ctx.strokeText(lines[i], width / 2, y);
      ctx.fillStyle = style.fontColor || '#FFFFFF';
      ctx.fillText(lines[i], width / 2, y);
    }
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), 'image/png'));
    return new Uint8Array(await blob.arrayBuffer());
  };

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
        if (progress > 0 && progress <= 1) {
          setComposeProgress(`処理中... ${Math.round(progress * 100)}%`);
        }
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
            // Burn subtitles if available
            if (scene.subtitle_text) {
              const subtitleStyle = scene.subtitle_style || { fontSize: 36, fontColor: '#FFFFFF', bgColor: 'rgba(0,0,0,0.7)', position: 'bottom', fontWeight: 'bold' };
              const aspectRatio = project.aspect_ratio || '9:16';
              const [w, h] = aspectRatio === '16:9' ? [1280, 720] : aspectRatio === '1:1' ? [960, 960] : [720, 1280];
              setComposeProgress(`シーン${scene.scene_number} 字幕を追加中...`);
              const subtitlePng = await createSubtitleImage(scene.subtitle_text, w, h, subtitleStyle);
              const overlayName = `overlay${i}.png`;
              await ffmpeg.writeFile(overlayName, subtitlePng);
              const subtitledName = `s${i}.mp4`;
              await ffmpeg.exec([
                "-i", mergedName,
                "-i", overlayName,
                "-filter_complex", "[0:v][1:v]overlay=0:0",
                "-c:v", "libx264", "-preset", "ultrafast",
                "-c:a", "copy",
                subtitledName
              ]);
              await ffmpeg.deleteFile(mergedName).catch(() => {});
              await ffmpeg.deleteFile(overlayName).catch(() => {});
              fileNames.push(subtitledName);
            } else {
              fileNames.push(mergedName);
            }
          } else {
            fileNames.push(videoName);
          }
        } else {
          // No audio - still burn subtitles if available
          if (scene.subtitle_text) {
            const subtitleStyle = scene.subtitle_style || { fontSize: 36, fontColor: '#FFFFFF', bgColor: 'rgba(0,0,0,0.7)', position: 'bottom', fontWeight: 'bold' };
            const aspectRatio = project.aspect_ratio || '9:16';
            const [w, h] = aspectRatio === '16:9' ? [1280, 720] : aspectRatio === '1:1' ? [960, 960] : [720, 1280];
            setComposeProgress(`シーン${scene.scene_number} 字幕を追加中...`);
            const subtitlePng = await createSubtitleImage(scene.subtitle_text, w, h, subtitleStyle);
            const overlayName = `overlay${i}.png`;
            await ffmpeg.writeFile(overlayName, subtitlePng);
            const subtitledName = `s${i}.mp4`;
            await ffmpeg.exec([
              "-i", videoName,
              "-i", overlayName,
              "-filter_complex", "[0:v][1:v]overlay=0:0",
              "-c:v", "libx264", "-preset", "ultrafast",
              subtitledName
            ]);
            await ffmpeg.deleteFile(overlayName).catch(() => {});
            fileNames.push(subtitledName);
          } else {
            fileNames.push(videoName);
          }
        }
      }

      // Concatenate all scenes
      setComposeProgress("全シーンを結合中...");
      if (fileNames.length === 1) {
        // Single scene - just rename
        const singleData = await ffmpeg.readFile(fileNames[0]);
        await ffmpeg.writeFile("concat.mp4", singleData);
      } else {
        const concatList = fileNames.map(n => `file '${n}'`).join("\n");
        await ffmpeg.writeFile("filelist.txt", concatList);
        // Re-encode to ensure consistent format across all scenes
        await ffmpeg.exec([
          "-f", "concat", "-safe", "0", "-i", "filelist.txt",
          "-c:v", "libx264", "-preset", "ultrafast",
          "-c:a", "aac",
          "-movflags", "+faststart",
          "concat.mp4"
        ]);
      }

      // Mix BGM if available
      let finalFile = "concat.mp4";
      if (bgmUrl) {
        try {
          setComposeProgress("BGMをダウンロード中...");
          const bgmResp = await fetch(bgmUrl);
          if (bgmResp.ok) {
            const bgmBuf = await bgmResp.arrayBuffer();
            await ffmpeg.writeFile("bgm.mp3", new Uint8Array(bgmBuf));

            setComposeProgress("BGMをミックス中...");
            // Mix: loop BGM to match video length, lower BGM volume to -18dB (0.125x)
            // Keep narration at full volume, blend BGM underneath
            await ffmpeg.exec([
              "-i", "concat.mp4",
              "-stream_loop", "-1", "-i", "bgm.mp3",
              "-filter_complex",
              "[0:a]volume=1.0[narration];[1:a]volume=0.12[bgm];[narration][bgm]amix=inputs=2:duration=first:dropout_transition=3[aout]",
              "-map", "0:v",
              "-map", "[aout]",
              "-c:v", "copy",
              "-c:a", "aac",
              "-shortest",
              "final_with_bgm.mp4"
            ]);
            finalFile = "final_with_bgm.mp4";
            await ffmpeg.deleteFile("bgm.mp3").catch(() => {});
          }
        } catch (bgmErr) {
          console.warn("BGM mix failed, using video without BGM:", bgmErr);
          // Continue with concat.mp4 without BGM
        }
      }

      const rawData = await ffmpeg.readFile(finalFile);
      const bytes = rawData instanceof Uint8Array ? rawData : new TextEncoder().encode(rawData as string);
      const blob = new Blob([bytes as BlobPart], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      setFinalVideoUrl(url);
      setComposeProgress("完了！ダウンロードを開始します...");

      // Auto-download
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.title || "video"}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Cleanup
      for (const name of fileNames) await ffmpeg.deleteFile(name).catch(() => {});
      await ffmpeg.deleteFile("filelist.txt").catch(() => {});
      await ffmpeg.deleteFile("concat.mp4").catch(() => {});
      await ffmpeg.deleteFile("final_with_bgm.mp4").catch(() => {});
    } catch (e) {
      console.error("Compose error:", e);
      alert("動画結合に失敗しました: " + (e instanceof Error ? e.message : String(e)));
      setComposeProgress("");
    } finally {
      setComposing(false);
    }
  };

  const handleGenerateBGM = async () => {
    setGeneratingBGM(true);
    try {
      const res = await fetch(`/api/w/${workspaceSlug}/video-projects/${videoProjectId}/generate-bgm`, {
        method: 'POST',
      });
      const result = await res.json();
      if (result.ok && result.bgmUrl) {
        setBgmUrl(result.bgmUrl);
        await loadProject();
      } else {
        alert(`BGM生成に失敗: ${result.error || '不明なエラー'}`);
      }
    } catch {
      alert('BGM生成に失敗しました');
    } finally {
      setGeneratingBGM(false);
    }
  };

  const handlePredictPerformance = async () => {
    setPredicting(true);
    try {
      const res = await fetch(`/api/w/${workspaceSlug}/video-projects/${videoProjectId}/predict-performance`, { method: 'POST' });
      const result = await res.json();
      if (result.ok) {
        setPrediction(result.data);
      } else {
        alert(`予測失敗: ${result.error || '不明なエラー'}`);
      }
    } catch {
      alert('パフォーマンス予測に失敗しました');
    } finally {
      setPredicting(false);
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

  const handleExportAll = async () => {
    if (!project) return;
    setExporting(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const title = project.title || "video_project";

      // 1. 台本（スクリプト）をテキストで出力
      setExportProgress("台本を作成中...");
      const sortedScenes = [...project.scenes].sort((a, b) => a.scene_number - b.scene_number);
      let scriptText = `# ${title}\n`;
      scriptText += `作成日: ${new Date().toLocaleDateString("ja-JP")}\n`;
      scriptText += `アスペクト比: ${project.aspect_ratio}\n`;
      scriptText += `ナレーション: ${project.voice_type === 'female' ? '女性' : '男性'}（${project.voice_style}）\n`;
      if (project.source_url) scriptText += `参照URL: ${project.source_url}\n`;
      if (project.custom_instructions) scriptText += `カスタム指示: ${project.custom_instructions}\n`;
      scriptText += `\n---\n\n`;

      for (const scene of sortedScenes) {
        scriptText += `## シーン ${scene.scene_number}（${Math.round(Number(scene.duration))}秒）\n\n`;
        if (scene.description) scriptText += `【シーン説明】\n${scene.description}\n\n`;
        if (scene.narration_text) scriptText += `【ナレーション】\n${scene.narration_text}\n\n`;
        if (scene.subtitle_text) scriptText += `【字幕テロップ】\n${scene.subtitle_text}\n\n`;
        if (scene.image_prompt) scriptText += `【画像プロンプト】\n${scene.image_prompt}\n\n`;
        scriptText += `---\n\n`;
      }

      // 会社分析情報も含める
      if (project.company_analysis) {
        const ca = project.company_analysis;
        scriptText += `\n## 分析情報\n\n`;
        if (ca.companyName) scriptText += `会社名: ${ca.companyName}\n`;
        if (ca.industry) scriptText += `業界: ${ca.industry}\n`;
        if (ca.targetAudience) scriptText += `ターゲット: ${ca.targetAudience}\n`;
        if (ca.tone) scriptText += `トーン: ${ca.tone}\n`;
        if (ca.keyMessages?.length) scriptText += `キーメッセージ:\n${ca.keyMessages.map(m => `  - ${m}`).join('\n')}\n`;
        if (ca.citations?.length) {
          scriptText += `\n### 引用情報\n`;
          for (const c of ca.citations) {
            scriptText += `- ${c.fact}（出典: ${c.source}）\n`;
          }
        }
        if (ca.marketInsights?.length) {
          scriptText += `\n### 市場インサイト\n`;
          for (const m of ca.marketInsights) {
            scriptText += `- ${m.insight}（根拠: ${m.basis}）\n`;
          }
        }
      }

      zip.file("台本.txt", scriptText);

      // 2. 画像をダウンロードしてZIPに追加
      const scenesWithImages = sortedScenes.filter(s => s.image_url);
      if (scenesWithImages.length > 0) {
        const imgFolder = zip.folder("画像");
        for (let i = 0; i < scenesWithImages.length; i++) {
          const scene = scenesWithImages[i];
          setExportProgress(`画像ダウンロード中... (${i + 1}/${scenesWithImages.length})`);
          try {
            const resp = await fetch(scene.image_url!);
            if (resp.ok) {
              const blob = await resp.blob();
              const ext = blob.type.includes("png") ? "png" : "jpg";
              imgFolder!.file(`シーン${scene.scene_number}.${ext}`, blob);
            }
          } catch {
            console.warn(`画像DL失敗: シーン${scene.scene_number}`);
          }
        }
      }

      // 3. 音声をダウンロードしてZIPに追加
      const scenesWithAudio = sortedScenes.filter(s => s.audio_url);
      if (scenesWithAudio.length > 0) {
        const audioFolder = zip.folder("ナレーション");
        for (let i = 0; i < scenesWithAudio.length; i++) {
          const scene = scenesWithAudio[i];
          setExportProgress(`ナレーション音声ダウンロード中... (${i + 1}/${scenesWithAudio.length})`);
          try {
            const resp = await fetch(proxyUrl(scene.id, 'audio'));
            if (resp.ok) {
              const blob = await resp.blob();
              audioFolder!.file(`シーン${scene.scene_number}_ナレーション.mp3`, blob);
            }
          } catch {
            console.warn(`音声DL失敗: シーン${scene.scene_number}`);
          }
        }
      }

      // 4. 動画をダウンロードしてZIPに追加
      const scenesWithVideo = sortedScenes.filter(s => s.video_url);
      if (scenesWithVideo.length > 0) {
        const videoFolder = zip.folder("動画");
        for (let i = 0; i < scenesWithVideo.length; i++) {
          const scene = scenesWithVideo[i];
          setExportProgress(`動画ダウンロード中... (${i + 1}/${scenesWithVideo.length})`);
          try {
            const resp = await fetch(proxyUrl(scene.id));
            if (resp.ok) {
              const blob = await resp.blob();
              videoFolder!.file(`シーン${scene.scene_number}.mp4`, blob);
            }
          } catch {
            console.warn(`動画DL失敗: シーン${scene.scene_number}`);
          }
        }
      }

      // 5. 広告パフォーマンス予測があれば追加
      if (prediction) {
        let predText = `# 広告パフォーマンス予測\n\n`;
        predText += `総合スコア: ${prediction.overallScore}/100 (${prediction.scoreLabel})\n\n`;
        if (prediction.metrics) {
          predText += `## 指標予測\n`;
          for (const [key, val] of Object.entries(prediction.metrics)) {
            predText += `- ${key}: ${val.predicted}（業界平均: ${val.benchmark}）\n`;
          }
          predText += `\n`;
        }
        if (prediction.strengths?.length) {
          predText += `## 強み\n${prediction.strengths.map(s => `- ${s}`).join('\n')}\n\n`;
        }
        if (prediction.weaknesses?.length) {
          predText += `## 改善点\n${prediction.weaknesses.map(w => `- ${w}`).join('\n')}\n\n`;
        }
        if (prediction.recommendations?.length) {
          predText += `## 改善提案\n${prediction.recommendations.map(r => `- ${r}`).join('\n')}\n\n`;
        }
        zip.file("広告パフォーマンス予測.txt", predText);
      }

      // 6. ZIPを生成してダウンロード
      setExportProgress("ZIPファイルを生成中...");
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      }, (metadata) => {
        setExportProgress(`ZIP作成中... ${Math.round(metadata.percent)}%`);
      });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title}_素材一式.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportProgress("エクスポート完了！");
      setTimeout(() => setExportProgress(""), 3000);
    } catch (e) {
      console.error("Export error:", e);
      alert("エクスポートに失敗しました: " + (e instanceof Error ? e.message : String(e)));
      setExportProgress("");
    } finally {
      setExporting(false);
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
            {project.source_url && (
              <>
                <a href={project.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                  {project.source_url}
                </a>
                {' / '}
              </>
            )}{project.aspect_ratio} / {project.voice_type === 'female' ? '女性' : '男性'}ナレーション（{({elegant: 'ゆっくり上品', energetic: '元気に広告風', speedy: 'スピーディー', brand: '大人っぽく洗練'} as Record<string, string>)[project.voice_style] || project.voice_style}） / {project.scenes.length}シーン
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
            {/* Export button when scenes exist but no video yet */}
            {project.scenes.length > 0 && !project.scenes.some(s => s.video_url) && (
              <Button onClick={handleExportAll} disabled={exporting} className="bg-teal-600 text-white hover:bg-teal-700 h-11 px-6">
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                台本・画像をエクスポート（ZIP）
              </Button>
            )}
            {project.scenes.some(s => s.video_url) && !project.scenes.some(s => s.audio_url) && project.status !== 'generating_audio' && (
              <Button onClick={() => runAction('generate-audio')} disabled={actionLoading} className="bg-orange-600 text-white hover:bg-orange-700 h-11 px-6">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                ナレーション生成
              </Button>
            )}
            {project.scenes.some(s => s.video_url) && (
              <>
                <Button onClick={handlePredictPerformance} disabled={predicting} className="bg-indigo-600 text-white hover:bg-indigo-700 h-11 px-6">
                  {predicting ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                  {prediction ? 'パフォーマンス再予測' : 'Meta広告パフォーマンス予測'}
                </Button>
                <Button onClick={handleGenerateBGM} disabled={generatingBGM} className="bg-purple-600 text-white hover:bg-purple-700 h-11 px-6">
                  {generatingBGM ? <Loader2 className="w-4 h-4 animate-spin" /> : <Music className="w-4 h-4" />}
                  {bgmUrl ? 'BGMを再生成' : 'BGMを生成'}（Gemini AI）
                </Button>
                <Button onClick={handleCompose} disabled={composing} className="bg-green-600 text-white hover:bg-green-700 h-11 px-6">
                  {composing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
                  {bgmUrl ? '動画を結合+BGMミックス' : '動画を結合してダウンロード'}
                </Button>
                <Button onClick={handleDownloadAll} variant="outline" className="h-11 px-6">
                  <Download className="w-4 h-4" />
                  個別ダウンロード
                </Button>
                <Button onClick={handleExportAll} disabled={exporting} className="bg-teal-600 text-white hover:bg-teal-700 h-11 px-6">
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                  素材一括エクスポート（ZIP）
                </Button>
              </>
            )}
            {bgmUrl && (
              <div className="w-full flex items-center gap-3 mt-1">
                <Music className="w-4 h-4 text-purple-500 flex-shrink-0" />
                <span className="text-xs text-purple-700 font-medium">BGM生成済み</span>
                <audio src={bgmUrl} controls className="h-8 flex-1" />
              </div>
            )}
            {composing && composeProgress && (
              <span className="text-sm text-blue-600 self-center">{composeProgress}</span>
            )}
            {exporting && exportProgress && (
              <span className="text-sm text-teal-600 self-center">{exportProgress}</span>
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

          {/* Ad Performance Prediction */}
          {prediction && (
            <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/50 p-6 mb-8">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                Meta広告パフォーマンス予測
              </h3>

              {/* Overall Score */}
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white ${
                  prediction.overallScore >= 80 ? 'bg-green-500' : prediction.overallScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
                }`}>
                  {prediction.overallScore}
                </div>
                <div>
                  <p className="text-lg font-bold">{prediction.scoreLabel || '評価'}</p>
                  <p className="text-xs text-muted-foreground">総合スコア（0-100）</p>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {prediction.metrics && Object.entries(prediction.metrics).map(([key, val]: [string, AdMetric]) => {
                  const labels: Record<string, string> = {
                    ctr: 'CTR', cpm: 'CPM', cpc: 'CPC', cvr: 'CVR',
                    hookRate: 'フック率', completionRate: '完視聴率', cpa: 'CPA'
                  };
                  const verdictColors: Record<string, string> = {
                    above: 'text-green-600', below: 'text-red-500', average: 'text-amber-600'
                  };
                  return (
                    <div key={key} className="bg-white rounded-lg p-3 border border-indigo-100">
                      <p className="text-[10px] text-muted-foreground mb-1">{labels[key] || key}</p>
                      <p className={`text-lg font-bold ${verdictColors[val.verdict] || ''}`}>{val.predicted}</p>
                      <p className="text-[10px] text-muted-foreground">業界平均: {val.benchmark}</p>
                    </div>
                  );
                })}
              </div>

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {prediction.strengths?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-green-700 mb-2">強み</p>
                    <ul className="space-y-1">
                      {prediction.strengths.map((s: string, i: number) => (
                        <li key={i} className="text-xs flex items-start gap-1.5">
                          <Check className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {prediction.weaknesses?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-600 mb-2">改善点</p>
                    <ul className="space-y-1">
                      {prediction.weaknesses.map((w: string, i: number) => (
                        <li key={i} className="text-xs flex items-start gap-1.5">
                          <AlertCircle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Recommendations */}
              {prediction.recommendations?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-indigo-700 mb-2">改善提案</p>
                  <div className="space-y-1.5">
                    {prediction.recommendations.map((r: string, i: number) => (
                      <p key={i} className="text-xs bg-white rounded p-2 border border-indigo-100">💡 {r}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Competitor Insights */}
              {prediction.competitorInsights?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-indigo-700 mb-2">競合情報</p>
                  <div className="space-y-1.5">
                    {prediction.competitorInsights.map((c: CompetitorInsight, i: number) => (
                      <div key={i} className="text-xs bg-white rounded p-2 border border-indigo-100">
                        <p className="font-medium">{c.insight}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">出典: {c.source}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sources */}
              {prediction.sources?.length > 0 && (
                <div className="pt-3 border-t border-indigo-200">
                  <p className="text-[10px] text-muted-foreground mb-1">参照データソース:</p>
                  <div className="flex flex-wrap gap-1">
                    {prediction.sources.slice(0, 5).map((s: PredictionSource, i: number) => (
                      <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-indigo-500 hover:underline bg-white rounded px-1.5 py-0.5 border border-indigo-100">
                        {s.title || s.url}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Analysis & Citations */}
          {project.company_analysis &&
            ((project.company_analysis.citations?.length || 0) > 0 || (project.company_analysis.marketInsights?.length || 0) > 0) && (
            <div className="mb-8">
              <button
                onClick={() => setShowAnalysis(!showAnalysis)}
                className="flex items-center gap-2 text-sm font-bold mb-3 hover:text-blue-600 transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                分析結果・引用情報
                {showAnalysis ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAnalysis && (
                <div className="space-y-4">
                  {/* Citations */}
                  {project.company_analysis.citations && project.company_analysis.citations.length > 0 && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                      <h3 className="text-xs font-semibold text-blue-700 mb-3 flex items-center gap-1.5">
                        <Quote className="w-3.5 h-3.5" />
                        サイトから抽出した情報
                      </h3>
                      <div className="space-y-2">
                        {project.company_analysis.citations.map((citation, idx) => (
                          <div key={idx} className="bg-white rounded-lg p-3 border border-blue-100">
                            <p className="text-sm font-medium text-foreground">{citation.fact}</p>
                            <p className="text-[11px] text-blue-600 mt-1">出典: {citation.source}</p>
                            {citation.context && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 italic">{`「${citation.context}」`}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Market Insights */}
                  {project.company_analysis.marketInsights && project.company_analysis.marketInsights.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                      <h3 className="text-xs font-semibold text-amber-700 mb-3 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" />
                        市場分析・インサイト
                      </h3>
                      <div className="space-y-2">
                        {project.company_analysis.marketInsights.map((insight, idx) => (
                          <div key={idx} className="bg-white rounded-lg p-3 border border-amber-100">
                            <p className="text-sm font-medium text-foreground">{insight.insight}</p>
                            <p className="text-[11px] text-amber-600 mt-1">根拠: {insight.basis}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
                            <div>
                              <label className="text-[10px] font-medium text-muted-foreground block mb-1">字幕テロップ</label>
                              <textarea
                                value={editFields.subtitle_text}
                                onChange={e => setEditFields(f => ({ ...f, subtitle_text: e.target.value }))}
                                className="w-full text-xs p-2 border border-amber-300 rounded bg-amber-50 resize-none focus:outline-none focus:ring-1 focus:ring-amber-400"
                                rows={2}
                                placeholder="字幕テキスト（空欄で非表示）"
                              />
                              <div className="flex gap-2 mt-1.5">
                                <select
                                  value={editFields.subtitle_style.fontSize}
                                  onChange={e => setEditFields(f => ({ ...f, subtitle_style: { ...f.subtitle_style, fontSize: Number(e.target.value) } }))}
                                  className="text-[10px] border border-border rounded px-1.5 py-1 bg-background"
                                >
                                  <option value={24}>小</option>
                                  <option value={30}>中</option>
                                  <option value={36}>大</option>
                                  <option value={42}>特大</option>
                                </select>
                                <select
                                  value={editFields.subtitle_style.fontColor}
                                  onChange={e => setEditFields(f => ({ ...f, subtitle_style: { ...f.subtitle_style, fontColor: e.target.value } }))}
                                  className="text-[10px] border border-border rounded px-1.5 py-1 bg-background"
                                >
                                  <option value="#FFFFFF">白文字</option>
                                  <option value="#FFFF00">黄色文字</option>
                                  <option value="#00FFFF">水色文字</option>
                                  <option value="#FF6B6B">赤文字</option>
                                </select>
                                <select
                                  value={editFields.subtitle_style.position}
                                  onChange={e => setEditFields(f => ({ ...f, subtitle_style: { ...f.subtitle_style, position: e.target.value } }))}
                                  className="text-[10px] border border-border rounded px-1.5 py-1 bg-background"
                                >
                                  <option value="bottom">下部</option>
                                  <option value="center">中央</option>
                                  <option value="top">上部</option>
                                </select>
                                <select
                                  value={editFields.subtitle_style.bgColor}
                                  onChange={e => setEditFields(f => ({ ...f, subtitle_style: { ...f.subtitle_style, bgColor: e.target.value } }))}
                                  className="text-[10px] border border-border rounded px-1.5 py-1 bg-background"
                                >
                                  <option value="rgba(0,0,0,0.7)">黒背景</option>
                                  <option value="rgba(0,0,0,0.4)">薄い黒背景</option>
                                  <option value="none">背景なし</option>
                                </select>
                              </div>
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

                            {scene.subtitle_text && (
                              <div>
                                <label className="text-[10px] font-medium text-muted-foreground block mb-1">字幕テロップ</label>
                                <div
                                  className="text-xs rounded p-2 text-center"
                                  style={{
                                    color: scene.subtitle_style?.fontColor || '#FFFFFF',
                                    backgroundColor: scene.subtitle_style?.bgColor || 'rgba(0,0,0,0.7)',
                                    fontSize: `${(scene.subtitle_style?.fontSize || 36) / 3}px`,
                                    fontWeight: scene.subtitle_style?.fontWeight || 'bold',
                                  }}
                                >
                                  {scene.subtitle_text}
                                </div>
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
                              {/* Audio regeneration */}
                              {scene.narration_text && scene.audio_url && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 text-[10px] h-7"
                                  onClick={() => regenerateAudio(scene.id)}
                                  disabled={regeneratingAudioSceneId === scene.id}
                                >
                                  {regeneratingAudioSceneId === scene.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Volume2 className="w-3 h-3" />}
                                  音声再生成
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

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import LoadingAnimation from "@/components/LoadingAnimation";
import ImageLightbox from "@/components/ImageLightbox";
import {
  ChevronLeft,
  Loader2,
  Wand2,
  Check,
  Download,
  Maximize2,
  FileSpreadsheet,
  Video,
} from "lucide-react";
import { useUser } from "@/lib/useUser";
import { Badge } from "@/components/ui/badge";
import ShareButton from "@/components/ShareButton";

interface StoryboardDetailProps {
  params: { workspaceSlug: string; storyboardId: string };
}

interface SceneData {
  id: string;
  scene_order: number;
  dialogue: string | null;
  description: string | null;
  image_prompt: string | null;
  image_url: string | null;
}

export default function StoryboardDetailPage({ params }: StoryboardDetailProps) {
  const { workspaceSlug, storyboardId } = params;
  const { user } = useUser();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [storyboardTitle, setStoryboardTitle] = useState("");
  const [, setProjectId] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [scenes, setScenes] = useState<SceneData[]>([]);

  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  const [savingSceneId, setSavingSceneId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingSheet, setExportingSheet] = useState(false);

  // Video creation from storyboard
  const [showVideoCreate, setShowVideoCreate] = useState(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState("9:16");
  const [videoVoiceType, setVideoVoiceType] = useState("female");
  const [creatingVideo, setCreatingVideo] = useState(false);

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // View mode: 'grid' (overview) or 'edit' (detailed editing)
  const [viewMode, setViewMode] = useState<"grid" | "edit">("grid");

  useEffect(() => {
    loadDraft();
  }, [workspaceSlug, storyboardId]);

  const loadDraft = async () => {
    setLoading(true);
    try {
      const data = await api.getDraft(workspaceSlug, storyboardId);
      setStoryboardTitle(data.storyboard.title);
      setProjectId(data.storyboard.project_id);
      setIsPublished(!!data.storyboard.current_published_version);
      setScenes(data.scenes);
    } catch (e) {
      console.error("Failed to load draft:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImage = async (sceneId: string) => {
    setGeneratingImageId(sceneId);
    try {
      const result = await api.generateSceneImage(workspaceSlug, sceneId);
      setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, image_url: result.image_url } : s)));
    } catch (e) {
      alert(`画像生成に失敗しました: ${e instanceof Error ? e.message : ""}`);
    } finally {
      setGeneratingImageId(null);
    }
  };

  const handleSaveScene = async (scene: SceneData) => {
    setSavingSceneId(scene.id);
    try {
      await api.updateDraftScene(workspaceSlug, scene.id, {
        dialogue: scene.dialogue,
        description: scene.description,
        image_prompt: scene.image_prompt,
      });
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSavingSceneId(null);
    }
  };

  const handleSaveAll = async () => {
    for (const s of scenes) await handleSaveScene(s);
    alert("全シーンを保存しました");
  };

  const updateScene = (id: string, field: string, value: string) =>
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const result = await api.publishStoryboard(workspaceSlug, storyboardId);
      setIsPublished(true);
      alert(`公開しました！（バージョン ${result.version_number}）`);
    } catch {
      alert("公開に失敗しました");
    } finally {
      setPublishing(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const html2canvas = (await import("html2canvas")).default;

      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "0";
      document.body.appendChild(container);

      const renderPage = async (pageDiv: HTMLDivElement, addNewPage: boolean) => {
        while (container.firstChild) container.removeChild(container.firstChild);
        container.appendChild(pageDiv);
        const canvas = await html2canvas(pageDiv, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
        });
        if (addNewPage) pdf.addPage();
        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        pdf.addImage(imgData, "JPEG", 0, 0, pageW, pageH);
      };

      // Title page
      const titlePage = document.createElement("div");
      titlePage.style.cssText = "width:1122px;height:793px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;background:#fff;";
      const titleEl = document.createElement("div");
      titleEl.style.cssText = "font-size:36px;font-weight:700;color:#18181b;margin-bottom:12px;";
      titleEl.textContent = storyboardTitle || "無題";
      titlePage.appendChild(titleEl);
      const subtitleEl = document.createElement("div");
      subtitleEl.style.cssText = "font-size:16px;color:#71717a;";
      subtitleEl.textContent = "絵コンテ - " + scenes.length + "シーン";
      titlePage.appendChild(subtitleEl);
      const dateEl = document.createElement("div");
      dateEl.style.cssText = "font-size:14px;color:#a1a1aa;margin-top:8px;";
      dateEl.textContent = new Date().toLocaleDateString("ja-JP");
      titlePage.appendChild(dateEl);
      await renderPage(titlePage, false);

      // Scene pages (4 scenes per page)
      for (let i = 0; i < scenes.length; i += 4) {
        const pageScenes = scenes.slice(i, i + 4);
        const pageDiv = document.createElement("div");
        pageDiv.style.cssText = "width:1122px;height:793px;padding:30px;box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif;background:#fff;";

        const header = document.createElement("div");
        header.style.cssText = "font-size:11px;color:#a1a1aa;margin-bottom:16px;display:flex;justify-content:space-between;";
        const headerLeft = document.createElement("span");
        headerLeft.textContent = storyboardTitle || "無題";
        const headerRight = document.createElement("span");
        headerRight.textContent = "Page " + (Math.floor(i / 4) + 1);
        header.appendChild(headerLeft);
        header.appendChild(headerRight);
        pageDiv.appendChild(header);

        const grid = document.createElement("div");
        grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:16px;height:calc(100% - 40px);";

        for (const scene of pageScenes) {
          const card = document.createElement("div");
          card.style.cssText = "border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;display:flex;position:relative;";

          const badge = document.createElement("div");
          badge.style.cssText = "position:absolute;top:8px;left:8px;width:28px;height:28px;border-radius:50%;background:#2563eb;color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;z-index:1;";
          badge.textContent = String(scene.scene_order);
          card.appendChild(badge);

          const imgContainer = document.createElement("div");
          imgContainer.style.cssText = "width:45%;background:#f4f4f5;display:flex;align-items:center;justify-content:center;flex-shrink:0;";
          if (scene.image_url) {
            const img = document.createElement("img");
            img.crossOrigin = "anonymous";
            img.src = scene.image_url;
            img.style.cssText = "width:100%;height:100%;object-fit:cover;";
            imgContainer.appendChild(img);
          } else {
            const noImg = document.createElement("div");
            noImg.style.cssText = "color:#a1a1aa;font-size:12px;";
            noImg.textContent = "No Image";
            imgContainer.appendChild(noImg);
          }
          card.appendChild(imgContainer);

          const textContainer = document.createElement("div");
          textContainer.style.cssText = "flex:1;padding:12px;overflow:hidden;font-size:11px;line-height:1.5;";

          if (scene.dialogue) {
            const dialogueBlock = document.createElement("div");
            dialogueBlock.style.cssText = "margin-bottom:8px;";
            const dialogueLabel = document.createElement("div");
            dialogueLabel.style.cssText = "font-size:9px;color:#71717a;font-weight:600;margin-bottom:3px;";
            dialogueLabel.textContent = "セリフ";
            const dialogueVal = document.createElement("div");
            dialogueVal.style.cssText = "color:#18181b;";
            dialogueVal.textContent = scene.dialogue;
            dialogueBlock.appendChild(dialogueLabel);
            dialogueBlock.appendChild(dialogueVal);
            textContainer.appendChild(dialogueBlock);
          }
          if (scene.description) {
            const descBlock = document.createElement("div");
            const descLabel = document.createElement("div");
            descLabel.style.cssText = "font-size:9px;color:#71717a;font-weight:600;margin-bottom:3px;";
            descLabel.textContent = "説明";
            const descVal = document.createElement("div");
            descVal.style.cssText = "color:#3f3f46;";
            descVal.textContent = scene.description;
            descBlock.appendChild(descLabel);
            descBlock.appendChild(descVal);
            textContainer.appendChild(descBlock);
          }
          card.appendChild(textContainer);
          grid.appendChild(card);
        }

        pageDiv.appendChild(grid);
        await renderPage(pageDiv, true);
      }

      document.body.removeChild(container);
      pdf.save(`${storyboardTitle || "storyboard"}.pdf`);
    } catch (e) {
      alert(`PDF出力に失敗しました: ${e instanceof Error ? e.message : ""}`);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportSheet = async () => {
    setExportingSheet(true);
    try {
      try {
        const result = await api.exportToSheets(workspaceSlug, storyboardId);
        window.open(result.spreadsheetUrl, "_blank");
        setExportingSheet(false);
        return;
      } catch { /* fall through to CSV */ }

      const headers = ["シーン番号", "セリフ", "シーン説明", "画像プロンプト", "画像URL"];
      const rows = scenes.map((s) => [
        String(s.scene_order),
        (s.dialogue || "").replace(/"/g, '""'),
        (s.description || "").replace(/"/g, '""'),
        (s.image_prompt || "").replace(/"/g, '""'),
        s.image_url || "",
      ]);
      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${storyboardTitle || "storyboard"}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`エクスポートに失敗しました: ${e instanceof Error ? e.message : ""}`);
    } finally {
      setExportingSheet(false);
    }
  };

  const handleCreateVideo = async () => {
    setCreatingVideo(true);
    try {
      const res = await fetch(`/api/w/${workspaceSlug}/storyboards/${storyboardId}/create-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_type: videoVoiceType, aspect_ratio: videoAspectRatio }),
      });
      const json = await res.json();
      if (json.ok && json.data?.id) {
        router.push(`/w/${workspaceSlug}/video/${json.data.id}`);
      } else {
        alert('動画プロジェクトの作成に失敗しました');
      }
    } catch {
      alert('エラーが発生しました');
    } finally {
      setCreatingVideo(false);
    }
  };

  // Lightbox
  const scenesWithImages = scenes.filter((s) => s.image_url);
  const openLightbox = (sceneId: string) => {
    const idx = scenesWithImages.findIndex((s) => s.id === sceneId);
    if (idx !== -1) setLightboxIndex(idx);
  };

  if (loading) {
    return (
      <>
        <Header title="絵コンテ" userEmail={user?.email} />
        <main className="flex-1 flex items-center justify-center">
          <LoadingAnimation message="絵コンテを読み込み中..." />
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="絵コンテ" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto p-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/w/${workspaceSlug}/storyboards`)}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              絵コンテ一覧
            </button>
            <h1 className="text-lg font-bold">{storyboardTitle}</h1>
            <Badge variant={isPublished ? "green" : "default"} className="text-xs">
              {isPublished ? "公開済み" : "ドラフト"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              一覧
            </Button>
            <Button
              variant={viewMode === "edit" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("edit")}
            >
              編集
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportSheet} disabled={exportingSheet}>
              {exportingSheet ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              スプレッドシート
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exportingPdf}>
              {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              PDF
            </Button>
            <Button size="sm" onClick={handlePublish} disabled={publishing} className="bg-zinc-900 text-white hover:bg-zinc-800">
              {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              公開する
            </Button>
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
                onClick={() => setShowVideoCreate(!showVideoCreate)}
              >
                <Video className="w-3.5 h-3.5" />
                動画を作成
              </Button>
              {showVideoCreate && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowVideoCreate(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg border border-border shadow-lg p-4 min-w-[260px]">
                    <p className="text-xs font-semibold mb-3">絵コンテから動画を生成</p>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] text-zinc-500 block mb-1">アスペクト比</label>
                        <select value={videoAspectRatio} onChange={e => setVideoAspectRatio(e.target.value)} className="w-full text-sm border border-border rounded-md px-2 py-1.5 bg-background">
                          <option value="9:16">9:16（縦・TikTok/Shorts）</option>
                          <option value="16:9">16:9（横・YouTube）</option>
                          <option value="1:1">1:1（正方形）</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-zinc-500 block mb-1">ナレーション音声</label>
                        <select value={videoVoiceType} onChange={e => setVideoVoiceType(e.target.value)} className="w-full text-sm border border-border rounded-md px-2 py-1.5 bg-background">
                          <option value="female">女性</option>
                          <option value="male">男性</option>
                        </select>
                      </div>
                      <Button size="sm" onClick={handleCreateVideo} disabled={creatingVideo} className="w-full bg-purple-600 text-white hover:bg-purple-700">
                        {creatingVideo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
                        動画プロジェクトを作成
                      </Button>
                      <p className="text-[10px] text-zinc-400">画像とセリフを引き継いで動画・ナレーションを生成します</p>
                    </div>
                  </div>
                </>
              )}
            </div>
            <ShareButton title={storyboardTitle || "絵コンテ"} text="絵コンテを共有" />
          </div>
        </div>

        {/* Grid View */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {scenes.map((scene) => (
              <div key={scene.id} className="rounded-xl border border-border bg-card overflow-hidden group">
                <div
                  className="relative aspect-video bg-zinc-800 flex items-center justify-center cursor-pointer"
                  onClick={() => scene.image_url && openLightbox(scene.id)}
                >
                  {scene.image_url ? (
                    <>
                      <img src={scene.image_url} alt={`Scene ${scene.scene_order}`} className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-zinc-500">画像なし</span>
                  )}
                  <div className="absolute top-2 left-2 bg-blue-600 text-white text-[11px] font-bold w-6 h-6 rounded-full flex items-center justify-center">
                    {scene.scene_order}
                  </div>
                </div>
                <div className="p-3">
                  {scene.dialogue && (
                    <div className="mb-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">セリフ</p>
                      <p className="text-xs leading-relaxed">{scene.dialogue}</p>
                    </div>
                  )}
                  {scene.description && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">概要</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{scene.description}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit View */}
        {viewMode === "edit" && (
          <>
            <div className="overflow-x-auto -mx-2">
              <div className="flex gap-4 pb-4 px-2" style={{ minWidth: "max-content" }}>
                {scenes.map((scene) => (
                  <div key={scene.id} className="w-72 flex-shrink-0 rounded-lg border border-border overflow-hidden">
                    <div
                      className="relative aspect-video bg-zinc-800 flex items-center justify-center cursor-pointer group"
                      onClick={() => scene.image_url && openLightbox(scene.id)}
                    >
                      {scene.image_url ? (
                        <>
                          <img src={scene.image_url} alt={`Scene ${scene.scene_order}`} className="w-full h-full object-cover" loading="lazy" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-zinc-400">画像なし</span>
                      )}
                      {generatingImageId === scene.id && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <LoadingAnimation />
                        </div>
                      )}
                    </div>
                    <div className="p-3 space-y-2">
                      <h3 className="text-sm font-bold">{scene.scene_order}コマ目</h3>
                      <div>
                        <label className="text-xs font-medium block mb-1">セリフ</label>
                        <textarea
                          value={scene.dialogue || ""}
                          onChange={(e) => updateScene(scene.id, "dialogue", e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-border rounded bg-background min-h-[50px] resize-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1">シーン説明</label>
                        <textarea
                          value={scene.description || ""}
                          onChange={(e) => updateScene(scene.id, "description", e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-border rounded bg-background min-h-[50px] resize-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1">生成プロンプト</label>
                        <textarea
                          value={scene.image_prompt || ""}
                          onChange={(e) => updateScene(scene.id, "image_prompt", e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-border rounded bg-background min-h-[40px] resize-none text-muted-foreground"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Button variant="outline" size="sm" className="text-xs h-7 flex-1"
                          onClick={() => handleSaveScene(scene)} disabled={savingSceneId === scene.id}>
                          {savingSceneId === scene.id && <Loader2 className="w-3 h-3 animate-spin" />}保存
                        </Button>
                        <Button variant="outline" size="sm" className="text-xs h-7 flex-1"
                          onClick={() => handleGenerateImage(scene.id)} disabled={generatingImageId === scene.id}>
                          {generatingImageId === scene.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}画像生成
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center mt-6">
              <Button variant="outline" onClick={handleSaveAll} className="w-56 h-11">全て保存する</Button>
            </div>
          </>
        )}
      </main>

      {/* Lightbox */}
      {lightboxIndex !== null && scenesWithImages[lightboxIndex] && (
        <ImageLightbox
          src={scenesWithImages[lightboxIndex].image_url!}
          alt={`シーン ${scenesWithImages[lightboxIndex].scene_order}`}
          onClose={() => setLightboxIndex(null)}
          hasPrev={lightboxIndex > 0}
          hasNext={lightboxIndex < scenesWithImages.length - 1}
          onPrev={() => setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() => setLightboxIndex((i) => (i !== null && i < scenesWithImages.length - 1 ? i + 1 : i))}
        />
      )}
    </>
  );
}

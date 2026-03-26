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
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const colW = (pageW - margin * 3) / 2;
      const rowH = (pageH - margin * 2 - 15) / 2;

      // Title page
      pdf.setFontSize(24);
      pdf.text(storyboardTitle || "無題", pageW / 2, pageH / 2 - 10, { align: "center" });
      pdf.setFontSize(12);
      pdf.text("Storyboard", pageW / 2, pageH / 2 + 5, { align: "center" });

      for (let i = 0; i < scenes.length; i += 4) {
        pdf.addPage();
        const pageScenes = scenes.slice(i, i + 4);
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(`${storyboardTitle || "無題"} - Page ${Math.floor(i / 4) + 1}`, margin, 10);
        pdf.setTextColor(0);

        for (let j = 0; j < pageScenes.length; j++) {
          const scene = pageScenes[j];
          const col = j % 2;
          const row = Math.floor(j / 2);
          const x = margin + col * (colW + margin);
          const y = margin + 5 + row * (rowH + 5);

          pdf.setDrawColor(220);
          pdf.setLineWidth(0.3);
          pdf.rect(x, y, colW, rowH);

          pdf.setFillColor(37, 99, 235);
          pdf.circle(x + 6, y + 6, 4, "F");
          pdf.setFontSize(8);
          pdf.setTextColor(255);
          pdf.text(String(scene.scene_order), x + 6, y + 7.5, { align: "center" });
          pdf.setTextColor(0);

          const imgW = colW * 0.45;
          const imgH = rowH - 10;
          if (scene.image_url) {
            try {
              pdf.addImage(scene.image_url, "PNG", x + 2, y + 12, imgW, imgH, undefined, "FAST");
            } catch {
              pdf.setFillColor(240, 240, 240);
              pdf.rect(x + 2, y + 12, imgW, imgH, "F");
            }
          } else {
            pdf.setFillColor(245, 245, 245);
            pdf.rect(x + 2, y + 12, imgW, imgH, "F");
          }

          const textX = x + imgW + 6;
          const textW = colW - imgW - 10;
          let textY = y + 14;

          if (scene.dialogue) {
            pdf.setFontSize(7);
            pdf.setTextColor(100);
            pdf.text("Dialogue:", textX, textY);
            textY += 4;
            pdf.setFontSize(8);
            pdf.setTextColor(0);
            const lines = pdf.splitTextToSize(scene.dialogue, textW);
            pdf.text(lines.slice(0, 4), textX, textY);
            textY += Math.min(lines.length, 4) * 4 + 3;
          }
          if (scene.description) {
            pdf.setFontSize(7);
            pdf.setTextColor(100);
            pdf.text("Description:", textX, textY);
            textY += 4;
            pdf.setFontSize(8);
            pdf.setTextColor(0);
            const lines = pdf.splitTextToSize(scene.description, textW);
            pdf.text(lines.slice(0, 5), textX, textY);
          }
        }
      }
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
            <Button
              size="sm"
              variant="outline"
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
              onClick={() => {
                const q = new URLSearchParams();
                if (storyboardTitle) q.set("title", storyboardTitle);
                router.push(`/w/${workspaceSlug}/video/new${q.toString() ? `?${q}` : ""}`);
              }}
            >
              <Video className="w-3.5 h-3.5" />
              動画を作成
            </Button>
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
                      <img src={scene.image_url} alt={`Scene ${scene.scene_order}`} className="w-full h-full object-cover" />
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
                          <img src={scene.image_url} alt={`Scene ${scene.scene_order}`} className="w-full h-full object-cover" />
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
